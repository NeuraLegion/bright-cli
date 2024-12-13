import {
  Discoveries,
  DiscoveryConfig,
  DiscoveryCreateResponse,
  DiscoveryType,
  Header,
  SourceType,
  StorageFile
} from './Discoveries';
import { ProxyFactory } from '../Utils';
import { CliInfo } from '../Config';
import { DiscoveryView } from './DiscoveryView';
import { delay, inject, injectable } from 'tsyringe';
import axios, { Axios } from 'axios';
import http from 'node:http';
import https from 'node:https';

export interface RestDiscoveryOptions {
  baseURL: string;
  apiKey: string;
  timeout?: number;
  insecure?: boolean;
  proxyURL?: string;
  proxyDomains?: string[];
}

export const RestDiscoveryOptions: unique symbol = Symbol(
  'RestDiscoveryOptions'
);

@injectable()
export class RestDiscoveries implements Discoveries {
  private readonly client: Axios;

  constructor(
    @inject(delay(() => CliInfo)) private readonly info: CliInfo,
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(RestDiscoveryOptions)
    { baseURL, apiKey, timeout, insecure, proxyURL }: RestDiscoveryOptions
  ) {
    const {
      httpAgent = new http.Agent(),
      httpsAgent = new https.Agent({ rejectUnauthorized: !insecure })
    } = proxyURL
      ? this.proxyFactory.createProxy({
          proxyUrl: proxyURL,
          rejectUnauthorized: !insecure
        })
      : {};

    this.client = axios.create({
      baseURL,
      timeout,
      httpAgent,
      httpsAgent,
      responseType: 'json',
      headers: { authorization: `Api-Key ${apiKey}` }
    });
  }

  public async create(
    projectId: string,
    config: DiscoveryConfig
  ): Promise<DiscoveryCreateResponse> {
    const preparedConfig = await this.prepareConfig({ ...config });
    const res = await this.client.post<DiscoveryCreateResponse>(
      `/api/v2/projects/${projectId}/discoveries`,
      preparedConfig
    );

    return res.data;
  }

  public async rerun(projectId: string, discoveryId: string): Promise<string> {
    const res = await this.client.post<{ id: string }>(
      `/api/v2/projects/${projectId}/discoveries/${discoveryId}/rerun`
    );

    return res.data.id;
  }

  public async stop(projectId: string, discoveryId: string): Promise<void> {
    await this.client.put(
      `/api/v2/projects/${projectId}/discoveries/${discoveryId}/lifecycle`,
      {
        action: 'stop'
      }
    );
  }

  public async delete(projectId: string, discoveryId: string): Promise<void> {
    await this.client.delete(
      `/api/v2/projects/${projectId}/discoveries/${discoveryId}`
    );
  }

  public async get(
    projectId: string,
    discoveryId: string,
    options?: { signal?: AbortSignal }
  ): Promise<DiscoveryView> {
    const res = await this.client.get<DiscoveryView>(
      `/api/v2/projects/${projectId}/discoveries/${discoveryId}`,
      { signal: options?.signal }
    );

    return res.data;
  }

  private async prepareConfig({ headers, ...rest }: DiscoveryConfig): Promise<
    Omit<DiscoveryConfig, 'headers'> & {
      headers: Header[];
      info: {
        source: string;
        client?: { name: string; version: string };
      };
    }
  > {
    const config = await this.applyDefaultSettings(rest);

    return {
      ...config,
      info: {
        source: 'cli',
        client: {
          name: 'bright-cli',
          version: this.info.version
        }
      },
      headers: headers
        ? Object.entries(headers).map(([name, value]: [string, string]) => ({
            name,
            value,
            mergeStrategy: 'replace'
          }))
        : undefined
    };
  }

  private async applyDefaultSettings(
    discoveryConfig: Omit<DiscoveryConfig, 'headers'>
  ): Promise<Omit<DiscoveryConfig, 'headers'>> {
    const exclusions =
      discoveryConfig.exclusions?.params || discoveryConfig.exclusions?.requests
        ? discoveryConfig.exclusions
        : undefined;

    let discoveryTypes: DiscoveryType[] = await this.exploreDiscovery(
      discoveryConfig
    );
    discoveryTypes = discoveryTypes?.length ? discoveryTypes : undefined;

    return {
      ...discoveryConfig,
      discoveryTypes,
      exclusions
    };
  }

  private async exploreDiscovery(
    body: DiscoveryConfig
  ): Promise<DiscoveryType[]> {
    const discoveryTypes: DiscoveryType[] = [];
    const { fileId, crawlerUrls } = body;

    if (Array.isArray(crawlerUrls)) {
      discoveryTypes.push(DiscoveryType.CRAWLER);
    }

    if (fileId) {
      try {
        const { data } = await this.client.get<StorageFile>(
          `/api/v2/files/${fileId}`
        );

        discoveryTypes.push(
          data.type === SourceType.HAR
            ? DiscoveryType.ARCHIVE
            : DiscoveryType.OAS
        );
      } catch (error) {
        throw new Error(
          `Error loading file with id "${fileId}": No such file or you do not have permissions.`
        );
      }
    }

    return discoveryTypes;
  }
}

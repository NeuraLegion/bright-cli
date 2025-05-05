import {
  Discovery,
  Header,
  ScanConfig,
  Scans,
  ScanState,
  SourceType,
  StorageFile,
  ATTACK_PARAM_LOCATIONS_DEFAULT,
  ScanCreateResponse,
  AttackParamLocation
} from './Scans';
import { CliInfo } from '../Config';
import { ProxyFactory } from '../Utils';
import { delay, inject, injectable } from 'tsyringe';
import axios, { Axios } from 'axios';
import http from 'node:http';
import https from 'node:https';

export interface RestScansOptions {
  baseURL: string;
  apiKey: string;
  timeout?: number;
  insecure?: boolean;
  proxyURL?: string;
  proxyDomains?: string[];
}

export const RestScansOptions: unique symbol = Symbol('RestScansOptions');

@injectable()
export class RestScans implements Scans {
  private readonly client: Axios;

  constructor(
    @inject(delay(() => CliInfo)) private readonly info: CliInfo,
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(RestScansOptions)
    { baseURL, apiKey, insecure, proxyURL, timeout }: RestScansOptions
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

  public async create(body: ScanConfig): Promise<ScanCreateResponse> {
    const scanConfig = await this.prepareScanConfig({ ...body });

    const res = await this.client.post<ScanCreateResponse>(
      '/api/v1/scans',
      scanConfig
    );

    return res.data;
  }

  public async retest(scanId: string): Promise<string> {
    const res = await this.client.post<{ id: string }>(
      `/api/v1/scans/${scanId}/retest`
    );

    return res.data.id;
  }

  public async status(scanId: string): Promise<ScanState> {
    const res = await this.client.get<ScanState>(`/api/v1/scans/${scanId}`);

    return res.data;
  }

  public async stop(scanId: string): Promise<void> {
    await this.client.get(`/api/v1/scans/${scanId}/stop`);
  }

  public async delete(scanId: string): Promise<void> {
    await this.client.delete(`/api/v1/scans/${scanId}`);
  }

  private async prepareScanConfig({ headers, ...rest }: ScanConfig): Promise<
    Omit<ScanConfig, 'headers'> & {
      headers: Header[];
      info: {
        source: string;
        client?: { name: string; version: string };
      };
    }
  > {
    const config = await this.applyDefaultSettings(rest);
    const updatedConfig = this.replaceDeprecatedAttackParamLocations(config);

    return {
      ...updatedConfig,
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

  private async exploreDiscovery(body: ScanConfig): Promise<Discovery[]> {
    const discoveryTypes: Discovery[] = [];
    const { fileId, crawlerUrls } = body;

    if (Array.isArray(crawlerUrls)) {
      discoveryTypes.push(Discovery.CRAWLER);
    }

    if (fileId) {
      try {
        const { data } = await this.client.get<StorageFile>(
          `/api/v2/files/${fileId}`
        );

        discoveryTypes.push(
          data.type === SourceType.HAR ? Discovery.ARCHIVE : Discovery.OAS
        );
      } catch (error) {
        throw new Error(
          `Error loading file with id "${fileId}": No such file or you do not have permissions.`
        );
      }
    }

    return discoveryTypes;
  }

  private async applyDefaultSettings(
    scanConfig: Omit<ScanConfig, 'headers'>
  ): Promise<Omit<ScanConfig, 'headers'>> {
    const attackParamLocations =
      scanConfig.attackParamLocations ??
      (scanConfig.templateId ? undefined : [...ATTACK_PARAM_LOCATIONS_DEFAULT]);

    const exclusions =
      scanConfig.exclusions?.params || scanConfig.exclusions?.requests
        ? scanConfig.exclusions
        : undefined;

    let discoveryTypes: Discovery[] = await this.exploreDiscovery(scanConfig);
    discoveryTypes = discoveryTypes?.length ? discoveryTypes : undefined;

    return {
      ...scanConfig,
      attackParamLocations,
      discoveryTypes,
      exclusions
    };
  }

  private replaceDeprecatedAttackParamLocations(
    scanConfig: Omit<ScanConfig, 'headers'>
  ): Omit<ScanConfig, 'headers'> {
    if (
      scanConfig.attackParamLocations?.includes(
        AttackParamLocation.ARTIFICAL_FRAGMENT
      )
    ) {
      scanConfig.attackParamLocations = scanConfig.attackParamLocations.filter(
        (loc) => loc !== AttackParamLocation.ARTIFICAL_FRAGMENT
      );

      if (
        !scanConfig.attackParamLocations?.includes(
          AttackParamLocation.ARTIFICIAL_FRAGMENT
        )
      ) {
        scanConfig.attackParamLocations = [
          ...scanConfig.attackParamLocations,
          AttackParamLocation.ARTIFICIAL_FRAGMENT
        ];
      }
    }

    if (
      scanConfig.attackParamLocations?.includes(
        AttackParamLocation.ARTIFICAL_QUERY
      )
    ) {
      scanConfig.attackParamLocations = scanConfig.attackParamLocations.filter(
        (loc) => loc !== AttackParamLocation.ARTIFICAL_QUERY
      );

      if (
        !scanConfig.attackParamLocations?.includes(
          AttackParamLocation.ARTIFICIAL_QUERY
        )
      ) {
        scanConfig.attackParamLocations = [
          ...scanConfig.attackParamLocations,
          AttackParamLocation.ARTIFICIAL_QUERY
        ];
      }
    }

    return scanConfig;
  }
}

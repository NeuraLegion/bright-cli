import {
  Discovery,
  Header,
  ScanConfig,
  ScanRetestConfig,
  Scans,
  ScanState,
  SourceType,
  StorageFile
} from './Scans';
import { CliInfo } from '../Config';
import request, { RequestPromiseAPI } from 'request-promise';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { delay, inject, injectable } from 'tsyringe';

export interface RestScansOptions {
  timeout?: number;
  insecure?: boolean;
  baseUrl: string;
  apiKey: string;
  proxyUrl?: string;
}

export const RestScansOptions: unique symbol = Symbol('RestScansOptions');

@injectable()
export class RestScans implements Scans {
  private readonly client: RequestPromiseAPI;

  constructor(
    @inject(delay(() => CliInfo)) private readonly info: CliInfo,
    @inject(RestScansOptions)
    { baseUrl, apiKey, insecure, proxyUrl, timeout = 10000 }: RestScansOptions
  ) {
    this.client = request.defaults({
      baseUrl,
      timeout,
      json: true,
      rejectUnauthorized: !insecure,
      agent: proxyUrl ? new SocksProxyAgent(proxyUrl) : undefined,
      headers: { authorization: `Api-Key ${apiKey}` }
    });
  }

  public async create(body: ScanConfig): Promise<string> {
    const scanConfig = await this.prepareScanConfig({ ...body });

    const { id }: { id: string } = await this.client.post({
      body: scanConfig,
      uri: `/api/v1/scans`
    });

    return id;
  }

  public async retest(
    scanId: string,
    body?: ScanRetestConfig
  ): Promise<string> {
    const { id }: { id: string } = await this.client.post({
      ...(body?.name && { body: { config: body } }),
      uri: `/api/v1/scans/${scanId}/retest`
    });

    return id;
  }

  public async status(scanId: string): Promise<ScanState> {
    return this.client.get({
      uri: `/api/v1/scans/${scanId}`
    });
  }

  public async stop(scanId: string): Promise<void> {
    await this.client.get({
      uri: `/api/v1/scans/${scanId}/stop`
    });
  }

  public async delete(scanId: string): Promise<void> {
    await this.client.delete({
      uri: `/api/v1/scans/${scanId}`
    });
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
    const discoveryTypes: Discovery[] = await this.exploreDiscovery(rest);

    return {
      ...rest,
      discoveryTypes,
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
        const file: StorageFile = await this.client.get({
          uri: `/api/v2/files/${fileId}`
        });

        discoveryTypes.push(
          file.type === SourceType.HAR ? Discovery.ARCHIVE : Discovery.OAS
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

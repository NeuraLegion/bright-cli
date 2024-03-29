import {
  Discovery,
  Header,
  ScanConfig,
  Scans,
  ScanState,
  SourceType,
  StorageFile,
  SCAN_TESTS_TO_RUN_BY_DEFAULT,
  ATTACK_PARAM_LOCATIONS_DEFAULT
} from './Scans';
import { CliInfo } from '../Config';
import { ProxyFactory } from '../Utils';
import request, { RequestPromiseAPI } from 'request-promise';
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
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(RestScansOptions)
    { baseUrl, apiKey, insecure, proxyUrl, timeout = 10000 }: RestScansOptions
  ) {
    this.client = request.defaults({
      baseUrl,
      timeout,
      json: true,
      rejectUnauthorized: !insecure,
      agent: proxyUrl
        ? this.proxyFactory.createProxyForClient({
            proxyUrl,
            targetUrl: baseUrl,
            rejectUnauthorized: !insecure
          })
        : undefined,
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

  public async retest(scanId: string): Promise<string> {
    const { id }: { id: string } = await this.client.post({
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

  private async applyDefaultSettings(
    scanConfig: Omit<ScanConfig, 'headers'>
  ): Promise<Omit<ScanConfig, 'headers'>> {
    const tests =
      scanConfig.tests ??
      (scanConfig.buckets ?? scanConfig.templateId
        ? undefined
        : [...SCAN_TESTS_TO_RUN_BY_DEFAULT]);
    const attackParamLocations =
      scanConfig.attackParamLocations ?? scanConfig.templateId
        ? undefined
        : [...ATTACK_PARAM_LOCATIONS_DEFAULT];
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
      exclusions,
      tests
    };
  }
}

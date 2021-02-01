import { Discovery, ScanConfig, Scans, ScanState } from './Scans';
import request, { RequestPromiseAPI } from 'request-promise';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { inject, injectable } from 'tsyringe';

export interface RestScansOptions {
  timeout?: number;
  baseUrl: string;
  apiKey: string;
  proxyUrl?: string;
}

export const RestScansOptions: unique symbol = Symbol('RestScansOptions');

@injectable()
export class RestScans implements Scans {
  private readonly client: RequestPromiseAPI;

  constructor(
    @inject(RestScansOptions)
    { baseUrl, apiKey, proxyUrl, timeout = 10000 }: RestScansOptions
  ) {
    this.client = request.defaults({
      baseUrl,
      timeout,
      json: true,
      agent: proxyUrl ? new SocksProxyAgent(proxyUrl) : undefined,
      headers: { authorization: `Api-Key ${apiKey}` }
    });
  }

  public async create(body: ScanConfig): Promise<string> {
    const { id }: { id: string } = await this.client.post({
      body: this.mergeDiscoveryTypes(body),
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

  private mergeDiscoveryTypes(config: ScanConfig): ScanConfig {
    const discoveryTypes: Discovery[] = this.exploreDiscovery(config);

    return { ...config, discoveryTypes } as ScanConfig;
  }

  private exploreDiscovery(body: ScanConfig): Discovery[] {
    const discoveryTypes: Discovery[] = [];

    if (Array.isArray(body.crawlerUrls)) {
      discoveryTypes.push(Discovery.CRAWLER);
    }

    if (body.fileId) {
      discoveryTypes.push(Discovery.ARCHIVE);
    }

    return discoveryTypes;
  }
}

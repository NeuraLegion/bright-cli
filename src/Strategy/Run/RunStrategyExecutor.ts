import * as request from 'request-promise';
import { RequestPromiseAPI } from 'request-promise';
import { RunStrategy } from './RunStrategy';

export enum Discovery {
  crawler = 'crawler',
  archive = 'archive',
  oas = 'oas'
}

export interface RunStrategyConfig {
  name: string;
  protocol: 'http' | 'websocket';
  poolSize?: number;
  type: 'appscan' | 'protoscan';
  module?: 'core' | 'exploratory';
  filePath?: string;
  fileDiscard?: boolean;
  build?: {
    service: string;
    buildNumber?: number;
    user?: string;
    project?: string;
    vcs?: 'github' | 'bitbucket';
  };
  extraHosts?: { [p: string]: string };
  headers?: { [p: string]: string };
  crawlerUrls?: string[];
  hostsFilter?: string[];
  agentsUuids?: string[];
}

export type DiscoveryTypes =
  | (Discovery.archive | Discovery.crawler)[]
  | Discovery.oas[];

export type ScanConfig = Exclude<
  RunStrategyConfig,
  'fileDiscard' & 'filePath'
> & {
  discoveryTypes: DiscoveryTypes;
  fileId?: string;
};

export type ResponseRef = { ids?: string[] } & { id?: string };

export class RunStrategyExecutor {
  private readonly proxy: RequestPromiseAPI;
  private readonly proxyConfig: {
    strictSSL: boolean;
    headers: { Authorization: string };
    baseUrl: string;
  };
  private readonly config: RunStrategyConfig;

  constructor(
    baseUrl: string,
    apiKey: string,
    config: RunStrategyConfig
  ) {
    this.proxyConfig = {
      baseUrl,
      strictSSL: false,
      headers: { Authorization: `Api-Key ${apiKey}` }
    };
    this.proxy = request.defaults(this.proxyConfig);
    this.config = config;
  }

  public async execute(strategy: RunStrategy): Promise<string> {
    const scanConfig: ScanConfig = await strategy.run(this.proxy, this.config);
    return this.configureScan(scanConfig);
  }

  protected async configureScan(body: ScanConfig): Promise<string> {
    const { id }: ResponseRef = await this.proxy.post({
      body,
      uri: `/scans`,
      json: true
    });

    console.log(`${body.name} scan was run.`);

    return id;
  }
}

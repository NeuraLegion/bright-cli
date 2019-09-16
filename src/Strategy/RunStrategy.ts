import { RequestPromiseAPI } from 'request-promise';
import * as request from 'request-promise';

export interface ScanConfig {
  name: string;
  discoveryTypes: ('archive' | 'crawler')[] | 'oas'[];
  protocol: 'http' | 'websocket';
  poolSize?: number;
  type: 'appscan' | 'protoscan';
  module?: 'core' | 'exploratory';
  filePath?: string;
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
  fileDiscard?: boolean;
}

export abstract class RunStrategy {
  protected readonly proxy: RequestPromiseAPI;

  protected constructor(baseUrl: string, apiKey: string) {
    this.proxy = request.defaults({
      baseUrl,
      strictSSL: false,
      headers: { Authorization: `Api-Key ${apiKey}` }
    });
  }

  public abstract run(config: ScanConfig): Promise<void>;

  protected async configureScan(
    config: ScanConfig,
    fileId?: string
  ): Promise<void> {
    await this.proxy.post({
      uri: `/scans`,
      json: true,
      body: { ...config, fileId }
    });

    console.log(`${config.name} scan was run by ${process.argv0}.`);
  }
}

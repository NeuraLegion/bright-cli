import * as request from 'request-promise';
import { RequestPromiseAPI } from 'request-promise';

export enum Discovery {
  crawler = 'crawler',
  archive = 'archive',
  oas = 'oas'
}

export enum ModuleRef {
  dast = 'dast',
  fuzzer = 'fuzzer'
}

export enum Module {
  core = 'core',
  exploratory = 'exploratory'
}

export interface RunStrategyConfig {
  name: string;
  protocol: 'http' | 'websocket';
  poolSize?: number;
  type: 'appscan' | 'protoscan';
  moduleRef?: ModuleRef;
  fileId?: string;
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

export interface ScanConfig extends Exclude<RunStrategyConfig, 'moduleRef'> {
  discoveryTypes: DiscoveryTypes;
  module: Module;
}

export class ScanManager {
  private readonly proxy: RequestPromiseAPI;
  private readonly proxyConfig: {
    strictSSL: boolean;
    headers: { Authorization: string };
    baseUrl: string;
  };

  constructor(baseUrl: string, apiKey: string) {
    this.proxyConfig = {
      baseUrl,
      strictSSL: false,
      headers: { Authorization: `Api-Key ${apiKey}` }
    };
    this.proxy = request.defaults(this.proxyConfig);
  }

  public async create(body: RunStrategyConfig): Promise<string> {
    const { id }: { id: string } = await this.proxy.post({
      body: this.extractScanConfig(body),
      uri: `/api/v1/scans`,
      json: true
    });

    return id;
  }

  public async retest(scanId: string): Promise<string> {
    const { id }: { id: string } = await this.proxy.post({
      uri: `/api/v1/scans/${scanId}/retest`,
      json: true
    });

    return id;
  }

  public async stop(scanId: string): Promise<void> {
    await this.proxy.post({
      uri: `/api/v1/scans/${scanId}/stop`,
      json: true
    });
  }

  public async delete(scanId: string): Promise<void> {
    await this.proxy.delete({
      uri: `/api/v1/scans/${scanId}`,
      json: true
    });
  }

  private extractScanConfig(strategyConfig: RunStrategyConfig): ScanConfig {
    const { moduleRef, ...partialConfig } = strategyConfig;
    const discoveryTypes: Discovery[] = this.getDiscovery(strategyConfig);
    const module: Module = this.getModule(moduleRef);
    return { ...partialConfig, discoveryTypes, module } as ScanConfig;
  }

  private getModule(moduleRef: ModuleRef): Module {
    switch (moduleRef) {
      case ModuleRef.dast:
        return Module.core;
      case ModuleRef.fuzzer:
        return Module.exploratory;
    }
  }

  private getDiscovery(body: RunStrategyConfig): Discovery[] {
    const discoveryTypes: Discovery[] = [];

    if (Array.isArray(body.crawlerUrls)) {
      discoveryTypes.push(Discovery.crawler);
    }

    if (body.fileId) {
      discoveryTypes.push(Discovery.archive);
    }

    return discoveryTypes;
  }
}

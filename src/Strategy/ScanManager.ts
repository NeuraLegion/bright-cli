import * as request from 'request-promise';
import { RequestPromiseAPI } from 'request-promise';

export enum Discovery {
  crawler = 'crawler',
  archive = 'archive',
  oas = 'oas'
}

export enum TestType {
  angular_csti = 'angular_csti',
  file_upload = 'file_upload',
  csrf = 'csrf',
  unvalidated_redirect = 'unvalidated_redirect',
  rfi = 'rfi',
  lfi = 'lfi',
  sqli = 'sqli',
  date_manipulation = 'date_manipulation',
  osi = 'osi',
  retire_js = 'retire_js',
  ssti = 'ssti',
  full_path_disclosure = 'full_path_disclosure',
  ldapi = 'ldapi',
  cookie_security = 'cookie_security',
  directory_listing = 'directory_listing',
  header_security = 'header_security',
  http_method_fuzzing = 'http_method_fuzzing',
  version_control_systems = 'version_control_systems',
  backup_locations = 'backup_locations',
  jwt = 'jwt',
  default_login_location = 'default_login_location',
  dom_xss = 'dom_xss',
  xss = 'xss',
  xxe = 'xxe',
  ssrf = 'ssrf',
  wordpress = 'wordpress',
  common_files = 'common_files',
  brute_force_login = 'brute_force_login',
  secret_tokens = 'secret_tokens'
}

export enum ModuleRef {
  dast = 'dast',
  fuzzer = 'fuzzer'
}

export enum Module {
  core = 'core',
  exploratory = 'exploratory'
}

export function toArray<T>(enumeration: any): T[] {
  return [...Object.values(enumeration)] as T[];
}

export interface RunStrategyConfig {
  name: string;
  poolSize?: number;
  moduleRef?: ModuleRef;
  fileId?: string;
  tests?: TestType[];
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

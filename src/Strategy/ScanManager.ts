import request, { RequestPromiseAPI } from 'request-promise';

export enum Discovery {
  CRAWLER = 'crawler',
  ARCHIVE = 'archive',
  OAS = 'oas'
}

export enum TestType {
  ANGULAR_CSTI = 'angular_csti',
  FILE_UPLOAD = 'file_upload',
  CSRF = 'csrf',
  UNVALIDATED_REDIRECT = 'unvalidated_redirect',
  RFI = 'rfi',
  LFI = 'lfi',
  SQLI = 'sqli',
  DATE_MANIPULATION = 'date_manipulation',
  OSI = 'osi',
  RETIRE_JS = 'retire_js',
  SSTI = 'ssti',
  FULL_PATH_DISCLOSURE = 'full_path_disclosure',
  LDAPI = 'ldapi',
  COOKIE_SECURITY = 'cookie_security',
  DIRECTORY_LISTING = 'directory_listing',
  HEADER_SECURITY = 'header_security',
  HTTP_METHOD_FUZZING = 'http_method_fuzzing',
  VERSION_CONTROL_SYSTEMS = 'version_control_systems',
  BACKUP_LOCATIONS = 'backup_locations',
  JWT = 'jwt',
  DEFAULT_LOGIN_LOCATION = 'default_login_location',
  DOM_XSS = 'dom_xss',
  XSS = 'xss',
  XXE = 'xxe',
  SSRF = 'ssrf',
  WORDPRESS = 'wordpress',
  COMMON_FILES = 'common_files',
  BRUTE_FORCE_LOGIN = 'brute_force_login',
  SECRET_TOKENS = 'secret_tokens',
  HRS = 'hrs'
}

export enum Module {
  DAST = 'dast',
  FUZZER = 'fuzzer'
}

export function toArray<T>(enumeration: any): T[] {
  return [...Object.values(enumeration)] as T[];
}

export interface RunStrategyConfig {
  name: string;
  poolSize?: number;
  module?: Module;
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
  agents?: string[];
}

export type DiscoveryTypes =
  | (Discovery.ARCHIVE | Discovery.CRAWLER)[]
  | Discovery.OAS[];

export interface ScanConfig extends RunStrategyConfig {
  discoveryTypes: DiscoveryTypes;
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
      body: this.getScanConfig(body),
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
    await this.proxy.get({
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

  private getScanConfig(config: RunStrategyConfig): ScanConfig {
    const discoveryTypes: Discovery[] = this.getDiscovery(config);

    return { ...config, discoveryTypes } as ScanConfig;
  }

  private getDiscovery(body: RunStrategyConfig): Discovery[] {
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

export interface DiscoveryConfig {
  name: string;
  authObjectId?: string;
  poolSize?: number;
  crawlerUrls?: string[];
  extraHosts?: Record<string, string>;
  headers?: Record<string, string> | Header[];
  fileId?: string;
  targetId?: string;
  hostsFilter?: string[];
  optimizedCrawler?: boolean;
  maxInteractionsChainLength: number;
  subdomainsCrawl: boolean;
  exclusions?: Exclusions;
  repeaters?: string[];
  discoveryTypes?: DiscoveryType[];
  targetTimeout: number;
}

export interface Header {
  name: string;
  value: string;
  mergeStrategy: 'replace';
}

export interface Discoveries {
  create(
    projectId: string,
    config: DiscoveryConfig
  ): Promise<DiscoveryCreateResponse>;

  rerun(projectId: string, discoveryId: string): Promise<string>;

  stop(projectId: string, discoveryId: string): Promise<void>;

  delete(projectId: string, discoveryId: string): Promise<void>;
}

export const Discoveries: unique symbol = Symbol('Discoveries');

export interface DiscoveryWarning {
  code: string;
  message: string;
}

export interface DiscoveryCreateResponse {
  id: string;
  warnings?: DiscoveryWarning[];
}

export enum DiscoveryType {
  CRAWLER = 'crawler',
  ARCHIVE = 'archive',
  OAS = 'oas'
}

export interface RequestExclusion {
  patterns: string[];
  methods: string[];
}

export interface Exclusions {
  params: string[];
  requests: RequestExclusion[];
}

export interface StorageFile {
  id: string;
  type: SourceType;
}

export enum SourceType {
  OPEN_API = 'openapi',
  RAML = 'raml',
  POSTMAN = 'postman',
  HAR = 'har'
}

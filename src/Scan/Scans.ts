import { Severity } from './Severity';

export enum Discovery {
  CRAWLER = 'crawler',
  ARCHIVE = 'archive',
  OAS = 'oas'
}

export enum AttackParamLocation {
  ARTIFICAL_FRAGMENT = 'artifical-fragment',
  ARTIFICAL_QUERY = 'artifical-query',
  BODY = 'body',
  FRAGMENT = 'fragment',
  HEADER = 'header',
  PATH = 'path',
  QUERY = 'query'
}

export const SCAN_TESTS_TO_RUN_BY_DEFAULT: string[] = [
  'angular_csti',
  'azure_blob_storage',
  'backup_locations',
  'bola',
  'business_constraint_bypass',
  'cve_test',
  'date_manipulation',
  'dom_xss',
  'google_cloud_storage',
  'excessive_data_exposure',
  'exposed_couch_db_apis',
  'hrs',
  'http_response_splitting',
  'id_enumeration',
  'lrrl',
  'mass_assignment',
  'prompt_injection',
  'retire_js'
];

export const ATTACK_PARAM_LOCATIONS_DEFAULT: readonly AttackParamLocation[] = [
  AttackParamLocation.BODY,
  AttackParamLocation.FRAGMENT,
  AttackParamLocation.QUERY
];

export enum Module {
  DAST = 'dast',
  FUZZER = 'fuzzer'
}

export interface Header {
  name: string;
  value: string;
  mergeStrategy: 'replace';
}

export interface RequestExclusion {
  patterns: string[];
  methods: string[];
}

export interface Exclusions {
  params: string[];
  requests: RequestExclusion[];
}

export interface ScanConfig {
  name: string;
  module: Module;
  authObjectId?: string;
  projectId?: string;
  templateId?: string;
  discoveryTypes?: Discovery[];
  tests?: string[];
  buckets?: string[];
  poolSize?: number;
  fileId?: string;
  attackParamLocations?: AttackParamLocation[];
  smart?: boolean;
  extraHosts?: Record<string, string>;
  exclusions?: Exclusions;
  headers?: Record<string, string> | Header[];
  crawlerUrls?: string[];
  hostsFilter?: string[];
  repeaters?: string[];
}

export enum ScanStatus {
  RUNNING = 'running',
  PENDING = 'pending',
  STOPPED = 'stopped',
  FAILED = 'failed',
  DONE = 'done',
  DISRUPTED = 'disrupted',
  SCHEDULED = 'scheduled',
  QUEUED = 'queued'
}

export type ScanIssues = Record<`numberOf${Severity}SeverityIssues`, number>;

export interface ScanState extends ScanIssues {
  status: ScanStatus;
}

export enum SourceType {
  OPEN_API = 'openapi',
  RAML = 'raml',
  POSTMAN = 'postman',
  HAR = 'har'
}

export interface StorageFile {
  id: string;
  type: SourceType;
}

export interface ScanWarning {
  code: string;
  message: string;
}

export interface ScanCreateResponse {
  id: string;
  warnings: ScanWarning[];
}

export interface Scans {
  create(body: ScanConfig): Promise<ScanCreateResponse>;

  retest(scanId: string): Promise<string>;

  stop(scanId: string): Promise<void>;

  delete(scanId: string): Promise<void>;

  status(scanId: string): Promise<ScanState>;
}

export const Scans: unique symbol = Symbol('Scans');

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
  HRS = 'hrs',
  HTML_INJECTION = 'html_injection',
  OPEN_DATABASE = 'open_database',
  OPEN_BUCKETS = 'open_buckets',
  BUSINESS_CONSTRAINT_BYPASS = 'business_constraint_bypass',
  ID_ENUMERATION = 'id_enumeration',
  NOSQL = 'nosql',
  BROKEN_SAML_AUTH = 'broken_saml_auth',
  PROTO_POLLUTION = 'proto_pollution'
}

export const COMPREHENSIVE_SCAN_TESTS: ReadonlyArray<TestType> = Object.values(
  TestType
).filter(
  (x: TestType) =>
    ![
      TestType.BUSINESS_CONSTRAINT_BYPASS,
      TestType.DATE_MANIPULATION,
      TestType.RETIRE_JS,
      TestType.ID_ENUMERATION
    ].includes(x)
);

export enum Module {
  DAST = 'dast',
  FUZZER = 'fuzzer'
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

export interface ScanConfig {
  name: string;
  module: Module;
  discoveryTypes?: Discovery[];
  tests: TestType[];
  poolSize?: number;
  fileId?: string;
  attackParamLocations?: AttackParamLocation[];
  smart?: boolean;
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
  repeaters?: string[];
}

export enum IssueCategory {
  MEDIUM = 'Medium',
  HIGH = 'High',
  LOW = 'Low'
}

export interface CountIssuesBySeverity {
  number: number;
  type: IssueCategory;
}

export enum ScanStatus {
  RUNNING = 'running',
  PENDING = 'pending',
  STOPPED = 'stopped',
  FAILED = 'failed',
  DONE = 'done',
  SCHEDULED = 'scheduled',
  QUEUED = 'queued'
}

export interface ScanState {
  status: ScanStatus;
  issuesBySeverity: CountIssuesBySeverity[];
}

export interface Scans {
  create(body: ScanConfig): Promise<string>;

  retest(scanId: string): Promise<string>;

  stop(scanId: string): Promise<void>;

  delete(scanId: string): Promise<void>;

  status(scanId: string): Promise<ScanState>;
}

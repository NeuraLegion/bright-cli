export interface Spec {
  content: string | Buffer;
  filename: string;
  type: SpecType;
  discard?: boolean;
  headers?: Record<string, string>;
  variables?: Record<string, string>;
}

export enum SpecType {
  NEXMOCK = 'NexMock',
  HAR = 'HAR',
  OPENAPI = 'OpenAPI',
  RAML = 'RAML',
  POSTMAN = 'Postman'
}

export interface Archives {
  upload(spec: Spec): Promise<string>;

  convertAndUpload(spec: Spec): Promise<string>;
}

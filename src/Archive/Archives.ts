export interface Spec {
  content: string | Buffer;
  filename: string;
  type: SpecType;
  contentType?: string;
  discard?: boolean;
  projectId?: string;
  headers?: Record<string, string>;
  variables?: Record<string, string>;
}

export enum SpecType {
  HAR = 'HAR',
  OPENAPI = 'OpenAPI',
  POSTMAN = 'Postman'
}

export interface Archives {
  upload(spec: Spec): Promise<string>;
}

export const Archives: unique symbol = Symbol('Archives');

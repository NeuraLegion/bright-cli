export interface Spec {
  content: string | Buffer;
  filename: string;
  type: SpecType;
  contentType?: string;
  discard?: boolean;
  headers?: Record<string, string>;
  variables?: Record<string, string>;
}

export enum SpecType {
  NEXMOCK = 'NexMock',
  HAR = 'har',
  OPENAPI = 'openapi',
  POSTMAN = 'postman'
}

export interface Archives {
  upload(spec: Spec): Promise<string>;
}

export const Archives: unique symbol = Symbol('Archives');

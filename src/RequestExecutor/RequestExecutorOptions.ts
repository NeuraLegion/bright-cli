import { Cert } from './Request';

export interface WhitelistMimeType {
  type: string;
  allowTruncation?: boolean;
}

export interface RequestExecutorOptions {
  timeout?: number;
  proxyUrl?: string;
  headers?: Record<string, string | string[]>;
  certs?: Cert[];
  whitelistMimes?: WhitelistMimeType[];
  maxBodySize?: number;
  maxContentLength?: number;
  reuseConnection?: boolean;
}

export const RequestExecutorOptions: unique symbol = Symbol(
  'RequestExecutorOptions'
);

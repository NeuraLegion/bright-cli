import { Cert } from './Request';

export interface RequestExecutorOptions {
  timeout?: number;
  proxyUrl?: string;
  headers?: Record<string, string | string[]>;
  certs?: Cert[];
  whitelistMimes?: string[];
  maxContentLength?: number;
  reuseConnection?: boolean;
  proxyDomains?: string[];
}

export const RequestExecutorOptions: unique symbol = Symbol(
  'RequestExecutorOptions'
);

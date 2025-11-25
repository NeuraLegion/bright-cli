import { Cert, Request } from './Request';

export interface CertificatesCache {
  add(request: Request, cert: Cert): void;
  get(request: Request): Cert | undefined;
}

export const CertificatesCache: unique symbol = Symbol('CertificatesCache');

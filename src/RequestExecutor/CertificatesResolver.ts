import { Cert, Request } from './Request';

export interface CertificatesResolver {
  resolve(request: Request, registeredCerts: Cert[]): Cert[];
}

export const CertificatesResolver: unique symbol = Symbol(
  'CertificatesResolver'
);

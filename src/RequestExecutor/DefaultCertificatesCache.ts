import { Helpers } from '../Utils';
import { CertificatesCache } from './CertificatesCache';
import { Cert, Request } from './Request';
import { injectable } from 'tsyringe';

@injectable()
export class DefaultCertificatesCache implements CertificatesCache {
  private readonly cache: Map<string, Cert> = new Map<string, Cert>();

  public add(request: Request, cert: Cert): void {
    const key = this.certificateCacheKeyFromRequest(request);
    if (this.cache.has(key)) {
      return;
    }
    this.cache.set(key, cert);
  }

  public get(request: Request): Cert | undefined {
    return this.cache.get(this.certificateCacheKeyFromRequest(request));
  }

  private certificateCacheKeyFromRequest(request: Request): string {
    const requestUrl = new URL(request.url);

    return `${requestUrl.hostname}_${Helpers.portFromURL(requestUrl)}`;
  }
}

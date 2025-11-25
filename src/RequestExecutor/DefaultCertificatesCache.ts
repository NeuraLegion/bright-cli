import { CertificatesCache } from './CertificatesCache';
import { Cert, Request } from './Request';
import { injectable } from 'tsyringe';

@injectable()
export class DefaultCertificatesCache implements CertificatesCache {
  private readonly cache: Map<string, Cert> = new Map<string, Cert>();

  public add(request: Request, cert: Cert): void {
    const key = this.certificateCacheKeyFromRequest(request);
    if (key in this.cache) {
      return;
    }
    this.cache.set(key, cert);
  }

  public get(request: Request): Cert | undefined {
    return this.cache.get(this.certificateCacheKeyFromRequest(request));
  }

  private certificateCacheKeyFromRequest(request: Request): string {
    const requestUrl = new URL(request.url);

    return `${requestUrl.hostname}_${this.portFromURL(requestUrl)}`;
  }

  private portFromURL(url: URL): string {
    return (
      url.port ||
      (url.protocol === 'http:' ? '80' : url.protocol === 'https:' ? '443' : '')
    );
  }
}

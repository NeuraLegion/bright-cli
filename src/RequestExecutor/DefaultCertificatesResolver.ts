import { Helpers } from '../Utils/Helpers';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
import { Cert, Request } from './Request';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DefaultCertificatesResolver implements CertificatesResolver {
  constructor(
    @inject(CertificatesCache)
    private readonly certificatesCache: CertificatesCache
  ) {}

  public resolve(request: Request, registeredCerts: Cert[]): Cert[] {
    const cachedCertificate = this.certificatesCache.get(request);
    if (cachedCertificate) {
      return [cachedCertificate];
    }

    const requestUrl = new URL(request.url);
    const port = Helpers.portFromURL(requestUrl);

    return registeredCerts.filter((cert: Cert) =>
      this.matchHostnameAndPort(requestUrl.hostname, port, cert)
    );
  }

  private matchHostnameAndPort(
    hostname: string,
    port: string,
    cert: Cert
  ): boolean {
    const hostNameMatch =
      cert.hostname === hostname ||
      Helpers.wildcardToRegExp(cert.hostname).test(hostname);

    if (!hostNameMatch) {
      return false;
    }

    if (!cert.port) {
      // ADHOC: hostNameMatch has been checked above and it's true
      return true;
    }

    return cert.port === port;
  }
}

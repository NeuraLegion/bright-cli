import { logger } from '../Utils';
import { Certificates } from './Certificates';
import loadWinCertificates from 'win-ca';
import https from 'https';
import { readFile } from 'fs';
import { promisify } from 'util';

export class CertificatesLoader implements Certificates {
  async load(): Promise<void> {
    switch (process.platform) {
      case 'win32':
        try {
          loadWinCertificates();
        } catch {
          logger.warn(
            `Warning: cannot load certificates from Trusted Root Certification Authorities Certificate Store.`
          );
        }
        break;

      case 'freebsd':
        await this.loadCertsFromFile(
          process.env.CERTIFICATE_PATH ??
            '/etc/openssl/certs/ca-certificates.crt'
        );
        break;

      case 'linux':
        await this.loadCertsFromFile(
          process.env.CERTIFICATE_PATH ?? '/etc/ssl/certs/ca-certificates.crt'
        );
        break;

      case 'openbsd':
        await this.loadCertsFromFile(
          process.env.CERTIFICATE_PATH ?? '/etc/ssl/ca-certificates.crt'
        );
        break;

      default:
        break;
    }
  }

  /**
   * workarounds about loading certs on linux https://github.com/nodejs/node/issues/4175
   * use update-ca-certificates to update '/etc/ssl/certs/ca-certificates.crt'
   */
  private async loadCertsFromFile(path: string): Promise<void> {
    try {
      const ca: string = await promisify(readFile)(path, 'utf8');
      https.globalAgent.options.ca = ca
        .split(/-----END CERTIFICATE-----\n?/)
        .filter((cert) => !!cert)
        .map((cert) => `${cert}-----END CERTIFICATE-----\n`);
    } catch {
      logger.warn(`Warning: cannot load certificates from ${path}.`);
    }
  }
}

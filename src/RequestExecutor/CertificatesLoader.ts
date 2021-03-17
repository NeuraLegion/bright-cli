import { logger } from '../Utils';
import loadWinCertificates from 'win-ca';
import https from 'https';
import fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export class CertificatesLoader {
  async load(): Promise<void> {
    switch (process.platform) {
      case 'win32':
        try {
          loadWinCertificates();
        } catch {
          logger.warn(
            `Warning: Cannot load certificates from Trusted Root Certification Authorities Certificate Store.`
          );
        }
        break;

      case 'freebsd':
        await this.loadCertsFromFile('/etc/openssl/certs/ca-certificates.crt');
        break;

      case 'linux':
        await this.loadCertsFromFile('/etc/ssl/certs/ca-certificates.crt');
        break;

      case 'openbsd':
        await this.loadCertsFromFile('/etc/ssl/ca-certificates.crt');
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
      const ca = await readFile(process.env.CERTIFICATE_PATH ?? path);
      https.globalAgent.options.ca = ca
        .toString()
        .split(/-----END CERTIFICATE-----\n?/)
        .filter((cert) => !!cert)
        .map((cert) => `${cert}-----END CERTIFICATE-----\n`);
    } catch {
      logger.warn(
        `Warning: Cannot load certificates from ${
          process.env.CERTIFICATE_PATH ?? path
        }.`
      );
    }
  }
}

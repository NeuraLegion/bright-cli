import { logger } from '../Utils';
import { Certificates } from './Certificates';
import loadWinCertificates from 'win-ca';
import https from 'node:https';
import { readFile } from 'node:fs/promises';

export class CertificatesLoader implements Certificates {
  private readonly CERT_FILES = [
    '/etc/ssl/certs/ca-certificates.crt', // Debian/Ubuntu/Gentoo etc.
    '/etc/pki/tls/certs/ca-bundle.crt', // Fedora/RHEL 6
    '/etc/ssl/ca-bundle.pem', // OpenSUSE
    '/etc/pki/tls/cacert.pem', // OpenELEC
    '/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem', // CentOS/RHEL 7
    '/etc/ssl/cert.pem' // Alpine Linux
  ];

  public async load(path?: string): Promise<void> {
    const win = process.platform === 'win32';

    try {
      if (win) {
        loadWinCertificates();
      } else if (typeof path === 'string') {
        await this.loadCertsFromFile(path);
      } else {
        await this.discoveryDefaultLocations();
      }
    } catch {
      logger.warn(
        `Error Loading Certificate: Cannot load certificates from ${
          win
            ? 'Trusted Root Certification Authorities Certificate Store'
            : path
        }.`
      );
    }
  }

  /**
   * Discovers possible certificate files; stop after finding one
   */
  private async discoveryDefaultLocations(): Promise<void> {
    for (const path of this.CERT_FILES) {
      try {
        await this.loadCertsFromFile(path);

        return;
      } catch {
        // noop
      }
    }

    logger.warn(
      `Error Loading Certificate: Cannot load certificates from the system root. Please use --cacert option to specify the accurate path to the file. https://docs.brightsec.com/docs/initializing-the-repeater#options`
    );
  }

  /**
   * Workarounds about loading certs on linux https://github.com/nodejs/node/issues/4175
   * use update-ca-certificates to update '/etc/ssl/certs/ca-certificates.crt'
   */
  private async loadCertsFromFile(path: string): Promise<void> {
    const ca: string = await readFile(path, 'utf8');

    https.globalAgent.options.ca = ca
      .split(/-----END CERTIFICATE-----\n?/)
      .filter((cert) => !!cert)
      .map((cert) => `${cert}-----END CERTIFICATE-----\n`);
  }
}

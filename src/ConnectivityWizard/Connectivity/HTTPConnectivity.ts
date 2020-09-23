import { Connectivity } from './Connectivity';
import logger from '../../Utils/Logger';
import https from 'https';
import http from 'http';
import { ClientRequest } from 'http';
import { URL } from 'url';

export class HTTPConnectivity implements Connectivity {
  private readonly connection_timeout = 30 * 1000; // 30 seconds
  private url: URL;

  constructor(url: URL) {
    this.url = url;
  }

  public async test(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const req: ClientRequest =
        this.url.protocol === 'https:' ? https.get(this.url) : http.get(this.url);

      req.once('response', () => {
        logger.debug(
          'Http connectivity test - received data the connection.The connection is succesfull.'
        );
        resolve(true);
      });
      req.once('error', () => {
        logger.debug(
          'Http connectivity test - received an error code on connection. The connection failed.'
        );
        resolve(false);
      });
      setTimeout(() => {
        logger.debug(
          'Http connectivity test - reached timeout. The connection failed.'
        );
        req.destroy();
      }, this.connection_timeout);
    });
  }
}

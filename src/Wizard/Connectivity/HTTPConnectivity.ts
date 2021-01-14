import { Connectivity } from './Connectivity';
import { logger } from '../../Utils';
import https from 'https';
import http, { ClientRequest, RequestOptions } from 'http';
import { URL } from 'url';
import { once } from 'events';

interface ReqFactory {
  request(options: RequestOptions): ClientRequest;
}

const requestFactoryRegistry: ReadonlyMap<string, ReqFactory> = new Map<
  string,
  ReqFactory
>([
  ['http:', http],
  ['https:', https]
]);

export class HTTPConnectivity implements Connectivity {
  private readonly CONNECTION_TIMEOUT = 30 * 1000; // 30 seconds
  private readonly options: RequestOptions;
  private readonly factory: ReqFactory;

  constructor({ port, hostname, protocol }: URL) {
    if (!hostname) {
      throw new Error('Missing proper hostname for http connectivity test');
    }
    this.factory = requestFactoryRegistry.get(protocol);
    this.options = {
      port,
      hostname,
      method: 'GET',
      timeout: this.CONNECTION_TIMEOUT
    };
  }

  public async test(): Promise<boolean> {
    try {
      const req: ClientRequest = this.factory.request(this.options);

      req.once('timeout', () => req.destroy(new Error('Reached timeout.')));
      req.end();

      await once(req, 'response');

      logger.debug('Http connectivity test. The connection is succesfull.');

      return true;
    } catch (err) {
      logger.debug(
        'Http connectivity test. The connection failed: %s',
        err.message
      );

      return false;
    }
  }
}

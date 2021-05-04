import { Connectivity } from './Connectivity';
import { logger } from '../../Utils';
import { TestType } from '../TestType';
import { injectable } from 'tsyringe';
import https, { RequestOptions } from 'https';
import http, { ClientRequest } from 'http';
import { URL } from 'url';
import { once } from 'events';

interface ReqFactory {
  request(options: RequestOptions): ClientRequest;
}

@injectable()
export class HTTPConnectivity implements Connectivity {
  public readonly type = TestType.HTTP;

  private readonly CONNECTION_TIMEOUT = 10 * 1000; // 10 seconds
  private readonly FACTORY_REGISTRY: ReadonlyMap<string, ReqFactory> = new Map<
    string,
    ReqFactory
  >([
    ['http:', http],
    ['https:', https]
  ]);

  public async test({ port, hostname, protocol }: URL): Promise<boolean> {
    const factory = this.FACTORY_REGISTRY.get(protocol);

    const req: ClientRequest = factory.request({
      port,
      hostname,
      method: 'GET',
      rejectUnauthorized: false,
      timeout: this.CONNECTION_TIMEOUT
    });

    try {
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
    } finally {
      if (!req.aborted) {
        req.abort();
      }
    }
  }
}

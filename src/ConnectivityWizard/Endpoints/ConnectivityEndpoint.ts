import { Endpoint } from './Endpoint';
import { ConnectivityTest } from '../ConnectivityTest';
import { ItemStatus } from '../ConnectivityStatus';
import { Tokens } from '../Tokens';
import { TokensOperations } from '../TokensOperations';
import Koa from 'koa';
import logger from 'src/Utils/Logger';
import httpReq from 'request';
import { URL } from 'url';
import { Socket } from 'net';
import https from 'https';
import http from 'http';
import { ClientRequest } from 'http';

export class ConnectivityEndpoint implements Endpoint {
  private readonly authTestEndpoint: string =
    'https://nexploit.app/api/v1/repeaters/user';
  private readonly http_test_endpoint: string = 'https://nexploit.app:443';
  private readonly tcp_test_fqdn: string = 'amq.nexploit.app';
  private readonly tcpt_test_port: number = 5672;
  private readonly connection_timeout = 30 * 1000; // 30 seconds

  private tokenOperations: TokensOperations;

  constructor(tokenOps: TokensOperations) {
    this.tokenOperations = tokenOps;
  }

  public async handle(ctx: Koa.Context): Promise<void> {
    const req = <ConnectivityTest>(<unknown>ctx.request.body);
    logger.debug(`Calling connectivity status test with type ${req}`);
    switch (req.type) {
      case 'tcp':
        ctx.body = <ItemStatus>{
          ok: await this.testTCPConnection()
        };
        break;
      case 'auth':
        ctx.body = <ItemStatus>{
          ok: await this.testAuthConnection()
        };
        break;
      case 'http':
        ctx.body = <ItemStatus>{
          ok: await this.testHTTPConnection()
        };
        break;
      default:
        ctx.body = <ItemStatus>{
          ok: false
        };
    }

    return null;
  }

  private async testAuthConnection(): Promise<boolean> {
    const url: URL = new URL(this.authTestEndpoint);
    const tokens: Tokens = this.tokenOperations.readTokens();

    return new Promise<boolean>((resolve) => {
      const req: httpReq.Request = httpReq.post(
        {
          url,
          timeout: this.connection_timeout,
          rejectUnauthorized: false,
          form: {
            username: tokens.repeaterId,
            password: tokens.authToken
          }
        },
        (error: any, response: httpReq.Response, body: string) => {
          if (error || response.statusCode !== 200) {
            resolve(false);
          }
          resolve(body === 'allow');
        }
      );
      req.on('error', () => {
        logger.error(
          'Auth HTTP connection failed. Could not make HTTP call to auth endpoint.'
        );
        resolve(false);
      });
      // setTimeout(() => {
      //   logger.debug(
      //     'testAuthConnection reached timeout. Destroying the HTTP connecttion.'
      //   );
      //   req.destroy();
      // }, this.connection_timeout);
    });
  }

  private async testHTTPConnection(): Promise<boolean> {
    const url: URL = new URL(this.http_test_endpoint);

    return new Promise<boolean>((resolve) => {
      const req: ClientRequest =
        url.protocol === 'https' ? https.get(url) : http.get(url);

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

  private async testTCPConnection(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      logger.debug(
        `TCP connectivity test - openning socket to ${this.tcp_test_fqdn}:${this.tcpt_test_port}`
      );
      const socket: Socket = new Socket();
      socket.setTimeout(this.connection_timeout, () => {
        logger.debug(
          `TCP connectivity test - reached socket timeout. Connection failed.`
        );
        socket.destroy();
        resolve(false);
      });
      socket.connect(this.tcpt_test_port, this.tcp_test_fqdn, () => {
        logger.debug(`TCP connectivity test - Connection succesfull.`);
        socket.destroy();
        resolve(true);
      });
      socket.on('error', (err: Error) => {
        logger.debug(
          `TCP connectivity test - received socket error. Connection failed.`,
          err
        );
        socket.destroy();
        resolve(false);
      });
    });
  }
}

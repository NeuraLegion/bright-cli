import { Tokens } from '../Entities/Tokens';
import { Connectivity } from './Connectivity';
import logger from '../../Utils/Logger';
import { TokensOperations } from '../TokensOperations';
import httpReq from 'request';
import { URL } from 'url';

export class AMQConnectivity implements Connectivity {
  private readonly connection_timeout = 30 * 1000; // 30 seconds

  private authEndpoint: URL;
  private tokenOperations: TokensOperations;

  constructor(tokensOperations: TokensOperations, url: URL) {
    this.tokenOperations = tokensOperations;
    this.authEndpoint = url;
  }

  public async test(): Promise<boolean> {
    const tokens: Tokens = this.tokenOperations.readTokens();

    return new Promise<boolean>((resolve) => {
      const req: httpReq.Request = httpReq.post(
        {
          url: this.authEndpoint,
          timeout: this.connection_timeout,
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
    });
  }
}

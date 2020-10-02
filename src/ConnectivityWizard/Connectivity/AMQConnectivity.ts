import { Tokens } from '../Entities/Tokens';
import { Connectivity } from './Connectivity';
import logger from '../../Utils/Logger';
import { TokensOperations } from '../TokensOperations';
import httpReq from 'request';
import { URL } from 'url';

export class AMQConnectivity implements Connectivity {
  private readonly CONNECTION_TIMEOUT = 30 * 1000; // 30 seconds

  private readonly authEndpoint: URL;
  private readonly tokenOperations: TokensOperations;

  constructor(tokensOperations: TokensOperations, url: URL) {
    this.tokenOperations = tokensOperations;
    this.authEndpoint = url;
  }

  public async test(): Promise<boolean> {
    const tokens: Tokens = this.tokenOperations.readTokens();

    return new Promise<boolean>((resolve) => {
      httpReq.post(
        {
          url: this.authEndpoint,
          timeout: this.CONNECTION_TIMEOUT,
          form: {
            username: tokens.repeaterId,
            password: tokens.authToken
          }
        },
        (error: Error, response: httpReq.Response, body: string) => {
          if (error || response.statusCode !== 200) {
            if (error) {
              logger.debug('AMQ connectivity failed: %s', error.message);
            } else {
              logger.debug(
                'AMQ connectivity failed with status code %d',
                response.statusCode
              );
            }

            return resolve(false);
          }

          logger.debug('AMQ connectivity test returned: %s', body);

          return resolve(body === 'allow');
        }
      );
    });
  }
}

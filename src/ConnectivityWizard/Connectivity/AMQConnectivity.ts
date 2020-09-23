import { URL } from 'url';
import { Tokens } from '../Entities/Tokens';
import { Connectivity } from './Connectivity';
import httpReq from 'request';
import logger from '../../Utils/Logger';
import { TokensOperations } from '../TokensOperations';

export class AMQConnectivity implements Connectivity {
    private readonly connection_timeout = 30 * 1000; // 30 seconds
    private readonly authTestEndpoint: string = 'https://nexploit.app/api/v1/repeaters/user';

    private tokenOperations: TokensOperations;

    constructor(tokensOperations: TokensOperations) {
        this.tokenOperations = tokensOperations;
    }

    public async test(): Promise<boolean> {
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
        });
    }
};
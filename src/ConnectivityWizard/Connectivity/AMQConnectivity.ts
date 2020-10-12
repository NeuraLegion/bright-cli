import { Credentials } from '../Models/Credentials';
import { Connectivity } from './Connectivity';
import logger from '../../Utils/Logger';
import { Tokens } from '../Tokens';
import { post } from 'request-promise';
import { URL } from 'url';

export class AMQConnectivity implements Connectivity {
  private readonly CONNECTION_TIMEOUT = 30 * 1000; // 30 seconds

  constructor(private readonly tokens: Tokens, private readonly url: URL) {}

  public async test(): Promise<boolean> {
    const {
      repeaterId: username,
      authToken: password
    }: Credentials | undefined = this.tokens.readTokens();

    try {
      const body = await post({
        url: this.url,
        timeout: this.CONNECTION_TIMEOUT,
        form: {
          username,
          password
        }
      });

      logger.debug('AMQ connectivity test returned: %s', body);

      return body === 'allow';
    } catch (res) {
      if (res.error) {
        logger.debug('AMQ connectivity failed: %s', res.error.message);
      } else {
        logger.debug(
          'AMQ connectivity failed with status code %d',
          res.response.statusCode
        );
      }

      return false;
    }
  }
}

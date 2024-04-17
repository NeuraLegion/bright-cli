import { TestType } from '../TestType';
import { Connectivity } from './Connectivity';
import { logger } from '../../Utils';
import { Credentials } from '../Credentials';
import { Tokens } from '../Tokens';
import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { URL } from 'url';
import { stringify } from 'querystring';

@injectable()
export class AMQConnectivity implements Connectivity {
  public readonly type = TestType.AUTH;
  private readonly CONNECTION_TIMEOUT = 10 * 1000; // 10 seconds

  constructor(@inject(Tokens) private readonly tokens: Tokens) {}

  public async test(url: URL): Promise<boolean> {
    const {
      repeaterId: username,
      authToken: password
    }: Credentials | undefined = this.tokens.readTokens();

    try {
      const { data } = await axios.post(
        url.toString(),
        stringify({
          username,
          password
        }),
        {
          timeout: this.CONNECTION_TIMEOUT,
          responseType: 'text'
        }
      );

      logger.debug('AMQ connectivity test returned: %s', data);

      return data === 'allow';
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        logger.debug(
          'AMQ connectivity failed with the status code: %s',
          err.response.status,
          err.response.data
        );
      } else {
        logger.debug('AMQ connectivity failed: %s', err.message);
      }

      return false;
    }
  }
}

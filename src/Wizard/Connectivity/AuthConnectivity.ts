import { TestType } from '../TestType';
import { Connectivity } from './Connectivity';
import { logger } from '../../Utils';
import { Credentials } from '../Credentials';
import { Tokens } from '../Tokens';
import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { resolve } from 'node:url';

@injectable()
export class AuthConnectivity implements Connectivity {
  public readonly type = TestType.AUTH;
  private readonly CONNECTION_TIMEOUT = 10 * 1000; // 10 seconds

  constructor(@inject(Tokens) private readonly tokens: Tokens) {}

  public async test(url: URL): Promise<boolean> {
    const { repeaterId, authToken }: Credentials | undefined =
      this.tokens.readTokens();

    try {
      const { data } = await axios.get<{ id: string }>(
        resolve(url.toString(), `/api/v1/repeaters/${repeaterId}`),
        {
          timeout: this.CONNECTION_TIMEOUT,
          headers: {
            Authorization: `api-key ${authToken}`
          }
        }
      );

      logger.debug(
        'Authentication test successful with repeater ID: %s',
        data.id
      );

      return data.id === repeaterId;
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        (err.status === 401 || err.status === 403 || err.status === 404)
      ) {
        logger.debug(
          'Authentication test failed with repeater ID: %s',
          repeaterId
        );
      } else {
        logger.debug('Authentication test failed: %s', err.message);
      }

      return false;
    }
  }
}

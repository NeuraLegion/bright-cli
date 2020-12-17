import { Endpoint } from './Endpoint';
import {
  AUTH_TOKEN_VALIDATION_REGEXP,
  Credentials,
  REPEATER_ID_VALIDATION_REGEXP
} from '../Models';
import logger from '../../Utils/Logger';
import { Tokens } from '../Tokens';
import Koa from 'koa';

export class SetTokensEndpoint implements Endpoint {
  constructor(private readonly tokens: Tokens) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    const req = ctx.request.body as Credentials;

    const { authToken, repeaterId } = req;

    if (!authToken || !AUTH_TOKEN_VALIDATION_REGEXP.test(authToken)) {
      logger.warn('Invalid value for authentication token');
      ctx.throw(400, 'Invalid value for authentication token');

      return;
    }

    if (!repeaterId || !REPEATER_ID_VALIDATION_REGEXP.test(repeaterId)) {
      logger.warn('Invalid value for repeater id');
      ctx.throw(400, 'Invalid value for repeater id');

      return;
    }

    try {
      this.tokens.writeTokens(req);

      ctx.body = req;
    } catch (err) {
      logger.error(`Failed to store tokens in file. Error: ${err.message}`);
      ctx.throw(400, 'Failed to store tokens in file');
    }
  }
}
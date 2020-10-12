import { Endpoint } from './Endpoint';
import {
  AuthTokenValidationRegExp,
  Credentials,
  RepeaterIdValidationRegExp
} from '../Entities/Credentials';
import logger from '../../Utils/Logger';
import { Tokens } from '../Tokens';
import Koa from 'koa';

export class SetTokensEndpoint implements Endpoint {
  constructor(private readonly tokens: Tokens) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    try {
      const req = <Credentials>ctx.request.body;

      if (!req.authToken || !AuthTokenValidationRegExp.test(req.authToken)) {
        logger.warn('Invalid value for authentication token');
        ctx.throw('Invalid value for authentication token');

        return;
      }

      if (!req.repeaterId || !RepeaterIdValidationRegExp.test(req.repeaterId)) {
        logger.warn('Invalid value for repeater id');
        ctx.throw('Invalid value for repeater id');

        return;
      }

      this.tokens.writeTokens(req);
      ctx.body = req;
    } catch (err) {
      logger.error(`Failed to store tokens in file. Error: ${err.message}`);
      ctx.throw(400, 'Failed to store tokens in file');
    }
  }
}

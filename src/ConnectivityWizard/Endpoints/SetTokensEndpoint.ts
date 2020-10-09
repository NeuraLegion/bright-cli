import { Endpoint } from './Endpoint';
import {
  Tokens,
  AuthTokenValidationRegExp,
  RepeaterIdValidationRegExp
} from '../Entities/Tokens';
import { TokensOperations } from '../TokensOperations';
import logger from '../../Utils/Logger';
import Koa from 'koa';

export class SetTokensEndpoint implements Endpoint {
  private tokenOperations: TokensOperations;

  constructor(tokenOps: TokensOperations) {
    this.tokenOperations = tokenOps;
  }

  public async handle(ctx: Koa.Context): Promise<void> {
    try {
      const req = <Tokens>ctx.request.body;

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

      this.tokenOperations.writeTokens(req);
      ctx.body = req;
    } catch (err) {
      logger.error(`Failed to store tokens in file. Error: ${err.message}`);
      ctx.throw('Failed to store tokens in file');
    }
  }
}

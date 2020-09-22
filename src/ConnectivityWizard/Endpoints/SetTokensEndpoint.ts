import { Endpoint } from './Endpoint';
import { Tokens } from '../Tokens';
import { TokensOperations } from '../TokensOperations';
import Koa from 'koa';
import logger from 'src/Utils/Logger';

export class SetTokensEndpoint implements Endpoint {
  private tokenOperations: TokensOperations;

  constructor(tokenOps: TokensOperations) {
    this.tokenOperations = tokenOps;
  }

  public handle(ctx: Koa.Context): Promise<void> {
    try {
      const req = <Tokens>ctx.request.body;
      this.tokenOperations.writeTokens(req);
      const resp: Tokens = req;
      ctx.body = resp;
    } catch (err) {
      logger.error(`Failed to store tokens in file. Error: ${err.message}`);
      ctx.throw('Failed to store tokens in file');

      return;
    }
  }
}

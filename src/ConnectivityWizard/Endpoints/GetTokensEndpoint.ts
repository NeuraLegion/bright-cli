import { Endpoint } from './Endpoint';
import { Tokens } from '../Tokens';
import { TokensOperations } from '../TokensOperations';
import Koa from 'koa';
import logger from '../../Utils/Logger';

export class GetTokensEndpoint implements Endpoint {
  private tokensOperations: TokensOperations;

  constructor(tokensOps: TokensOperations) {
    this.tokensOperations = tokensOps;
  }

  public handle(ctx: Koa.Context): Promise<void> {
    try {
      const resp: Tokens = this.tokensOperations.readTokens();
      ctx.body = resp;
    } catch (err) {
      logger.error(`Failed to read tokens from file. Error: ${err.message}`);
      ctx.throw('Failed to read tokens from file');
    }

    return;
  }
}

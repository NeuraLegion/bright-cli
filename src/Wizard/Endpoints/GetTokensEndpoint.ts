import { Endpoint } from './Endpoint';
import { logger } from '../../Utils';
import { Tokens } from '../Tokens';
import Koa from 'koa';

export class GetTokensEndpoint implements Endpoint {
  constructor(private readonly tokens: Tokens) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    try {
      ctx.body = this.tokens.readTokens();
    } catch (err) {
      logger.error(`Failed to read tokens from file. Error: %s`, err.message);
      ctx.throw(404, 'Failed to read tokens from file.');
    }
  }
}

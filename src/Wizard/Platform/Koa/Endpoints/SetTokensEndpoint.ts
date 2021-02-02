import { Endpoint } from './Endpoint';
import { Credentials } from '../../../Models';
import { logger } from '../../../../Utils';
import { Tokens } from '../../../Tokens';
import Koa from 'koa';
import { inject, injectable } from 'tsyringe';

@injectable()
export class SetTokensEndpoint implements Endpoint {
  constructor(@inject(Tokens) private readonly tokens: Tokens) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    const req = ctx.request.body as Credentials;

    try {
      this.tokens.writeTokens(req);

      ctx.body = req;
    } catch (err) {
      logger.error(`Failed to store tokens in file. Error: ${err.message}`);
      ctx.throw(400, 'Failed to store tokens in file');
    }
  }
}

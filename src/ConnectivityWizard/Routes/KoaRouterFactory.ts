import { RouterFactory } from './RouterFactory';
import { GetTokensEndpoint } from '../Endpoints/GetTokensEndpoint';
import { SetTokensEndpoint } from '../Endpoints/SetTokensEndpoint';
import { ConnectivityEndpoint } from '../Endpoints/ConnectivityEndpoint';

import { ScanEndpoint } from '../Endpoints/ScanEndpoint';
import { FinishEndpoint } from '../Endpoints/FinishEndpoint';
import { TokensOperations } from '../TokensOperations';
import Koa from 'koa';
import Router from 'koa-router';

export class KoaRouterFactory implements RouterFactory {
  private readonly tokensOperations = new TokensOperations();
  private readonly getTokensEndpoint = new GetTokensEndpoint(
    this.tokensOperations
  );
  private readonly setTokenEndpoint = new SetTokensEndpoint(
    this.tokensOperations
  );
  private readonly setConnectivityEndpoint = new ConnectivityEndpoint(
    this.tokensOperations
  );
  private readonly setScanEndpoint = new ScanEndpoint(this.tokensOperations);
  private readonly setFinishEndpoint = new FinishEndpoint();

  public async createRouter(): Promise<Router> {
    const router: Router = new Router();

    router.get('/api/tokens', async (ctx: Koa.Context, next: Koa.Next) => {
      await this.getTokensEndpoint.handle(ctx);
      await next();
    });

    router.post('/api/tokens', async (ctx: Koa.Context, next: Koa.Next) => {
      await this.setTokenEndpoint.handle(ctx);
      await next();
    });

    router.post(
      '/api/connectivity-status',
      async (ctx: Koa.Context, next: Koa.Next) => {
        await this.setConnectivityEndpoint.handle(ctx);
        await next();
      }
    );

    router.post('/api/scan', async (ctx: Koa.Context, next: Koa.Next) => {
      await this.setScanEndpoint.handle(ctx);
      await next();
    });

    router.post('/api/finish', async (ctx: Koa.Context, next: Koa.Next) => {
      await this.setFinishEndpoint.handle(ctx);
      await next();
    });

    return null;
  }
}

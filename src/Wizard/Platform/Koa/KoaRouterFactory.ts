import {
  ConnectivityEndpoint,
  FinishEndpoint,
  GetTokensEndpoint,
  ScanEndpoint,
  SetTokensEndpoint
} from '../../Endpoints';
import Router from 'koa-router';
import Koa from 'koa';
import { injectable } from 'tsyringe';

@injectable()
export class KoaRouterFactory {
  constructor(
    private readonly setFinishEndpoint: FinishEndpoint,
    private readonly setScanEndpoint: ScanEndpoint,
    private readonly setTokenEndpoint: SetTokensEndpoint,
    private readonly getTokensEndpoint: GetTokensEndpoint,
    private readonly setConnectivityEndpoint: ConnectivityEndpoint
  ) {}

  public async createRouter(): Promise<Router> {
    return new Router()
      .get('/api/tokens', async (ctx: Koa.Context, next: Koa.Next) => {
        await this.getTokensEndpoint.handle(ctx);
        await next();
      })
      .post('/api/tokens', async (ctx: Koa.Context, next: Koa.Next) => {
        await this.setTokenEndpoint.handle(ctx);
        await next();
      })
      .post(
        '/api/connectivity-status',
        async (ctx: Koa.Context, next: Koa.Next) => {
          await this.setConnectivityEndpoint.handle(ctx);
          await next();
        }
      )
      .post('/api/scan', async (ctx: Koa.Context, next: Koa.Next) => {
        await this.setScanEndpoint.handle(ctx);
        await next();
      })
      .post('/api/finish', async (ctx: Koa.Context, next: Koa.Next) => {
        await this.setFinishEndpoint.handle(ctx);
        await next();
      });
  }
}

import { KoaRouterFactory } from './KoaRouterFactory';
import {
  ConnectivityEndpoint,
  FinishEndpoint,
  GetTokensEndpoint,
  ScanEndpoint,
  SetTokensEndpoint
} from '../../Endpoints';
import { FSTokens } from '../../FSTokens';
import { TestType } from '../../Models';
import {
  AMQConnectivity,
  Connectivity,
  HTTPConnectivity,
  TCPConnectivity
} from '../../Connectivity';
import Router from 'koa-router';
import Koa from 'koa';
import { URL } from 'url';

export class DefaultKoaRouterFactory implements KoaRouterFactory {
  private readonly tokens = new FSTokens();
  private readonly getTokensEndpoint = new GetTokensEndpoint(this.tokens);
  private readonly setTokenEndpoint = new SetTokensEndpoint(this.tokens);
  private readonly setConnectivityEndpoint: ConnectivityEndpoint;
  private readonly setScanEndpoint = new ScanEndpoint(this.tokens);
  private readonly setFinishEndpoint = new FinishEndpoint();
  private readonly connectivityTestRegistry: Map<TestType, Connectivity>;

  constructor(options: Map<TestType, URL>) {
    this.connectivityTestRegistry = new Map<TestType, Connectivity>()
      .set(TestType.HTTP, new HTTPConnectivity(options.get(TestType.HTTP)))
      .set(TestType.TCP, new TCPConnectivity(options.get(TestType.TCP)))
      .set(
        TestType.AUTH,
        new AMQConnectivity(this.tokens, options.get(TestType.AUTH))
      );
    this.setConnectivityEndpoint = new ConnectivityEndpoint(
      this.connectivityTestRegistry
    );
  }

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

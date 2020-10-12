import { RouterFactory } from './RouterFactory';
import { GetTokensEndpoint } from '../Endpoints/GetTokensEndpoint';
import { SetTokensEndpoint } from '../Endpoints/SetTokensEndpoint';
import { ConnectivityEndpoint } from '../Endpoints/ConnectivityEndpoint';
import { ScanEndpoint } from '../Endpoints/ScanEndpoint';
import { FinishEndpoint } from '../Endpoints/FinishEndpoint';
import { FSTokens } from '../FSTokens';
import { TestType } from '../Entities/ConnectivityTest';
import { HTTPConnectivity } from '../Connectivity/HTTPConnectivity';
import { TCPConnectivity } from '../Connectivity/TCPConnectivity';
import { AMQConnectivity } from '../Connectivity/AMQConnectivity';
import { Connectivity } from '../Connectivity/Connectivity';
import { Tokens } from '../Tokens';
import Router from 'koa-router';
import Koa from 'koa';
import { URL } from 'url';

export class KoaRouterFactory implements RouterFactory {
  private readonly tokens: Tokens;
  private readonly getTokensEndpoint: GetTokensEndpoint;
  private readonly setTokenEndpoint: SetTokensEndpoint;
  private readonly setConnectivityEndpoint: ConnectivityEndpoint;
  private readonly setScanEndpoint: ScanEndpoint;
  private readonly setFinishEndpoint: FinishEndpoint;
  private readonly connectivityTestRegistry: Map<TestType, Connectivity>;

  constructor(options: Map<TestType, URL>) {
    this.tokens = new FSTokens();
    this.getTokensEndpoint = new GetTokensEndpoint(this.tokens);
    this.setTokenEndpoint = new SetTokensEndpoint(this.tokens);
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
    this.setScanEndpoint = new ScanEndpoint(this.tokens);
    this.setFinishEndpoint = new FinishEndpoint();
  }

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

    return router;
  }
}

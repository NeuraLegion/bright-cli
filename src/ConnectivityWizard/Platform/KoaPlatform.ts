import { KoaRouterFactory } from './KoaRouterFactory';
import logger from '../../Utils/Logger';
import { DefaultKoaRouterFactory } from './DefaultKoaRouterFactory';
import { TestType } from '../Models/ConnectivityTest';
import { Platform } from './Platform';
import Koa from 'koa';
import json from 'koa-json';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import send from 'koa-send';
import Router from 'koa-router';
import findPort, { makeRange } from 'get-port';
import { join } from 'path';
import { URL } from 'url';
import { Server } from 'net';

export class KoaPlatform implements Platform {
  private readonly routerFactory: KoaRouterFactory;
  private readonly BIND_PORT: number = 3000;
  private readonly RANGE_SIZE: number = 500;

  constructor(options: Map<TestType, URL>) {
    this.routerFactory = new DefaultKoaRouterFactory(options);
  }

  public async start(): Promise<Server> {
    const root: string = join(process.cwd(), '/wizard-dist/Wizard');
    logger.debug('Using static path for client %s', root);

    const router: Router = await this.routerFactory.createRouter();
    const app: Koa = new Koa();

    app
      .use(serve(root))
      .use(json())
      .use(bodyParser())
      .use(async (ctx: Koa.Context, next: Koa.Next) => {
        await send(ctx, '/index.html', { root });
        await next();
      })
      .use(router.routes());

    const port: number = await findPort({
      port: makeRange(this.BIND_PORT, this.BIND_PORT + this.RANGE_SIZE)
    });

    return app.listen(port, () =>
      logger.log(
        `Please browse to http://localhost:${port} to begin the configurations of the Repeater`
      )
    );
  }
}

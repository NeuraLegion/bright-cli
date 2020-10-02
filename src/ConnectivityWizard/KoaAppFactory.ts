import { RouterFactory } from './Routes/RouterFactory';
import logger from '../Utils/Logger';
import Koa from 'koa';
import json from 'koa-json';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import send from 'koa-send';

export class KoaAppFactory {
  private routerFactory: RouterFactory;

  constructor(routerFactory: RouterFactory) {
    this.routerFactory = routerFactory;
  }

  public async createApp(): Promise<Koa> {
    const app: Koa = new Koa();

    const static_path: string = process.cwd() + '/wizard-dist/Wizard';
    logger.debug('Using static path for client %s', static_path);
    app.use(serve(static_path));
    app.use(json());
    app.use(bodyParser());
    app.use(async (ctx: Koa.Context, next: Koa.Next) => {
      await send(ctx, '/index.html', { root: static_path });
      await next();
    });
    app.use((await this.routerFactory.createRouter()).routes());
    return app;
  }
}

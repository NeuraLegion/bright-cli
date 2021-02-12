import { logger } from '../../../Utils';
import { KoaRouterFactory } from './KoaRouterFactory';
import { Platform } from '../Platform';
import Koa from 'koa';
import json from 'koa-json';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import send from 'koa-send';
import Router from 'koa-router';
import findPort, { makeRange } from 'get-port';
import { injectable } from 'tsyringe';
import { join } from 'path';
import { Server } from 'net';

@injectable()
export class KoaPlatform implements Platform {
  private readonly root = join(__dirname, 'public');
  private readonly BIND_PORT: number = 3000;
  private readonly RANGE_SIZE: number = 500;
  private server: Server;

  constructor(private readonly routerFactory: KoaRouterFactory) {}

  public async start(): Promise<void> {
    logger.debug('Using static path for client %s', this.root);

    const router: Router = await this.routerFactory.createRouter();
    const app: Koa = new Koa();

    app
      .use(serve(this.root))
      .use(json())
      .use(bodyParser())
      .use(async (ctx: Koa.Context, next: Koa.Next) => {
        await send(ctx, '/index.html', { root: this.root });
        await next();
      })
      .use(router.routes());

    const port: number = await findPort({
      port: makeRange(this.BIND_PORT, this.BIND_PORT + this.RANGE_SIZE)
    });

    this.server = app.listen(port, () =>
      logger.log(
        `Please browse to http://localhost:${port} to begin the configurations of the Repeater`
      )
    );
  }

  public async stop(): Promise<void> {
    this.server.close();
  }
}

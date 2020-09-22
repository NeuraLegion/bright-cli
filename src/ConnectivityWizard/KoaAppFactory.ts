import { RouterFactory } from './Routes/RouterFactory';
import Koa from 'koa';
import json from 'koa-json';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import logger from 'src/Utils/Logger';

export class KoaAppFactory {
  private routerFactory: RouterFactory;
  private app: Koa;

  constructor(routerFactory: RouterFactory) {
    this.routerFactory = routerFactory;
  }

  public async createApp(): Promise<Koa> {
    this.app = new Koa();

    const static_path: string = process.cwd() + '/wizard-dist/Wizard';
    logger.debug(`Using static path for client ${static_path}`);
    this.app.use(serve(static_path));
    this.app.use(json());
    this.app.use(bodyParser());
    this.app.use((await this.routerFactory.createRouter()).routes());

    return this.app;
  }
}

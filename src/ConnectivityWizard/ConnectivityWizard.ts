import logger from '../Utils/Logger';
import { KoaRouterFactory } from './Routes/KoaRouterFactory';
import { KoaAppFactory } from './KoaAppFactory';
import Koa from 'koa';
import getPort from 'get-port';
import { TestType } from './Entities/ConnectivityTest';
import { URL } from 'url';

export class ConnectivityWizard {
  private readonly bind_port: number = 3000;
  private readonly range_size: number = 500;
  private app: Koa;

  public async init(options: Map<TestType, URL>): Promise<void> {
    const routesFactory = new KoaRouterFactory(options);
    this.app = await new KoaAppFactory(routesFactory).createApp();

    //select available port and launch http listener
    const selected_port: number = await getPort({
      port: getPort.makeRange(this.bind_port, this.bind_port + this.range_size)
    });

    this.app.listen(selected_port);

    logger.log(
      `Please browse to http://localhost:${selected_port} to begin the configurations of the Repeater`
    );
  }
}

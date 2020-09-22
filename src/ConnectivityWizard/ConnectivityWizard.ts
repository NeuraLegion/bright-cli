import logger from '../Utils/Logger';
import { KoaRouterFactory } from './Routes/KoaRouterFactory';
import { KoaAppFactory } from './KoaAppFactory';
import Koa from 'koa';
import getPort from 'get-port';

export class ConnectivityWizard {
  private readonly bind_port: number = 3000;
  private app: Koa;

  public async init(): Promise<void> {
    const routesFactory = new KoaRouterFactory();
    this.app = await new KoaAppFactory(routesFactory).createApp();

    //select available port and launch http listener
    const selected_port: number = await getPort({
      port: getPort.makeRange(this.bind_port, this.bind_port + 500)
    });

    this.app.listen(selected_port);

    logger.log(
      `Please browse to http://localhost:${selected_port} to begin the configurations of the Repeater`
    );
  }
}

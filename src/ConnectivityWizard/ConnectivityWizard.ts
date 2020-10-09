import logger from '../Utils/Logger';
import { KoaRouterFactory } from './Routes/KoaRouterFactory';
import { KoaAppFactory } from './KoaAppFactory';
import { TestType } from './Entities/ConnectivityTest';
import Koa from 'koa';
import getPort from 'get-port';
import { URL } from 'url';

export class ConnectivityWizard {
  private readonly BIND_PORT: number = 3000;
  private readonly RANGE_SIZE: number = 500;
  private app: Koa;

  public async init(options: Map<TestType, URL>): Promise<void> {
    const routesFactory = new KoaRouterFactory(options);
    this.app = await new KoaAppFactory(routesFactory).createApp();

    //select available port and launch http listener
    const selectedPort: number = await getPort({
      port: getPort.makeRange(this.BIND_PORT, this.BIND_PORT + this.RANGE_SIZE)
    });

    this.app.listen(selectedPort);

    logger.log(
      `Please browse to http://localhost:${selectedPort} to begin the configurations of the Repeater`
    );
  }
}

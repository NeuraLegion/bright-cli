import { Endpoint } from './Endpoint';
import { ConnectivityTest, TestType } from '../Models/ConnectivityTest';
import { ItemStatus } from '../Models/ConnectivityStatus';
import logger from '../../Utils/Logger';
import { Connectivity } from '../Connectivity/Connectivity';
import Koa from 'koa';

export class ConnectivityEndpoint implements Endpoint {
  constructor(
    private readonly connectivityTestRegistry: ReadonlyMap<
      TestType,
      Connectivity
    >
  ) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    const req: ConnectivityTest = ctx.request.body;

    logger.debug('Calling connectivity status test with type %s', req.type);

    const connectivity: Connectivity = this.connectivityTestRegistry.get(
      req.type
    );

    ctx.body = {
      ok: await connectivity.test()
    } as ItemStatus;
  }
}

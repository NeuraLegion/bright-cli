import { Endpoint } from './Endpoint';
import { ConnectivityTest, ItemStatus, TestType } from '../Models';
import { logger } from '../../Utils';
import { Connectivity } from '../Connectivity';
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

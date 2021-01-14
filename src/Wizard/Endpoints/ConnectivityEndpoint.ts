import { Endpoint } from './Endpoint';
import { ConnectivityTest, ItemStatus, TestType } from '../Models';
import { logger } from '../../Utils';
import { Connectivity } from '../Connectivity';
import Koa from 'koa';
import { inject, injectable, injectAll } from 'tsyringe';
import { URL } from 'url';

export const ConnectivityUrls = Symbol('ConnectivityUrls');

@injectable()
export class ConnectivityEndpoint implements Endpoint {
  constructor(
    @inject(ConnectivityUrls) private readonly options: Map<TestType, URL>,
    @injectAll(Connectivity)
    private readonly connectivityTestRegistry: Connectivity[]
  ) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    const req: ConnectivityTest = ctx.request.body;

    logger.debug('Calling connectivity status test with type %s', req.type);

    const connectivity:
      | Connectivity
      | undefined = this.connectivityTestRegistry.find(
      (x: Connectivity) => x.type === req.type
    );

    if (!connectivity) {
      return ctx.throw('Selected test is not support.', 501);
    }

    ctx.body = {
      ok: await connectivity.test(this.options.get(connectivity.type))
    } as ItemStatus;
  }
}

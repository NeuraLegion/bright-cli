import { Endpoint } from './Endpoint';
import { ConnectivityTest, TestType } from '../Entities/ConnectivityTest';
import { ItemStatus } from '../Entities/ConnectivityStatus';
import { TokensOperations } from '../TokensOperations';
import logger from '../../Utils/Logger';
import { Connectivity } from '../Connectivity/Connectivity';
import { HTTPConnectivity } from '../Connectivity/HTTPConnectivity';
import { TCPConnectivity } from '../Connectivity/TCPConnectivity';
import { AMQConnectivity } from '../Connectivity/AMQConnectivity';
import Koa from 'koa';

export class ConnectivityEndpoint implements Endpoint {
  private connectivityTests: Map<TestType, Connectivity> = new Map();

  constructor(tokenOps: TokensOperations) {
    this.connectivityTests.set('http', new HTTPConnectivity());
    this.connectivityTests.set('tcp', new TCPConnectivity());
    this.connectivityTests.set('auth', new AMQConnectivity(tokenOps));
  }

  public async handle(ctx: Koa.Context): Promise<void> {
    const req = <ConnectivityTest>(<unknown>ctx.request.body);
    logger.debug(`Calling connectivity status test with type ${req}`);
    ctx.body = <ItemStatus>{
      ok: await this.connectivityTests.get(req.type).test()
    };

    return;
  }
}

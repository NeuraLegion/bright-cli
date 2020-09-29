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
import { URL } from 'url';

export class ConnectivityEndpoint implements Endpoint {
  private connectivityTests: Map<TestType, Connectivity> = new Map();

  constructor(tokenOps: TokensOperations, endpoints: Map<TestType, URL>) {
    this.connectivityTests.set(
      'http',
      new HTTPConnectivity(endpoints.get('http'))
    );
    this.connectivityTests.set(
      'tcp',
      new TCPConnectivity(endpoints.get('tcp'))
    );
    this.connectivityTests.set(
      'auth',
      new AMQConnectivity(tokenOps, endpoints.get('auth'))
    );
  }

  public async handle(ctx: Koa.Context): Promise<void> {
    const req = ctx.request.body as ConnectivityTest;
    logger.debug('Calling connectivity status test with type %s', req.type);
    ctx.body = <ItemStatus>{
      ok: await this.connectivityTests.get(req.type).test()
    };

    return;
  }
}

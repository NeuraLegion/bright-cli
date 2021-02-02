import { Endpoint } from './Endpoint';
import { DefaultConnectivityAnalyzer } from '../../../Services';
import { ConnectivityTest } from '../../../Models';
import Koa from 'koa';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ConnectivityEndpoint implements Endpoint {
  constructor(
    @inject(DefaultConnectivityAnalyzer)
    private readonly connectivityService: DefaultConnectivityAnalyzer
  ) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    const req: ConnectivityTest = ctx.request.body;

    ctx.body = {
      ok: await this.connectivityService.verifyAccess(req.type)
    };
  }
}

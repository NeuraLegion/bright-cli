import { Endpoint } from './Endpoint';
import { ConnectivityAnalyzer } from '../../../Services';
import { ConnectivityTest } from '../../../Models';
import Koa from 'koa';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ConnectivityEndpoint implements Endpoint {
  constructor(
    @inject(ConnectivityAnalyzer)
    private readonly connectivityService: ConnectivityAnalyzer
  ) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    const req: ConnectivityTest = ctx.request.body;

    ctx.body = {
      ok: await this.connectivityService.verifyAccess(req.type)
    };
  }
}

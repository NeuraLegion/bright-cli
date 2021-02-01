import { Endpoint } from './Endpoint';
import Koa from 'koa';
import { inject, injectable } from 'tsyringe';
import { ConnectivityService } from 'src/Wizard/Services/ConnectivityService';
import { ConnectivityTest } from 'src/Wizard/Models/ConnectivityTest';

@injectable()
export class ConnectivityEndpoint implements Endpoint {
  constructor(
    @inject(ConnectivityService)
    private readonly connectivityService: ConnectivityService
  ) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    const req: ConnectivityTest = ctx.request.body;

    ctx.body = {
      ok: await this.connectivityService.getConnectivityStatus(req.type)
    };
  }
}

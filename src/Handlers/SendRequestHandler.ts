import { bind, Handler } from '../Bus';
import { Request, RequestExecutor, Response } from '../RequestExecutor';
import { ExecuteScript, ForwardResponse } from './Events';
import { inject, injectable } from 'tsyringe';

@injectable()
@bind(ExecuteScript)
export class SendRequestHandler
  implements Handler<ExecuteScript, ForwardResponse> {
  constructor(
    @inject(RequestExecutor) private readonly requestExecutor: RequestExecutor
  ) {}

  public async handle(event: ExecuteScript): Promise<ForwardResponse> {
    const response: Response = await this.requestExecutor.execute(
      new Request(event)
    );

    return new ForwardResponse(
      response.status,
      response.headers,
      response.body
    );
  }
}

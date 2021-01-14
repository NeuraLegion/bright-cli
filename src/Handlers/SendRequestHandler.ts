import { bind, Handler } from '../Bus';
import { RequestExecutor, Request, Response } from '../RequestExecutor';
import { ExecuteScript, ForwardResponse } from './Events';

@bind(ExecuteScript)
export class SendRequestHandler
  implements Handler<ExecuteScript, ForwardResponse> {
  constructor(private readonly requestExecutor: RequestExecutor) {}

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

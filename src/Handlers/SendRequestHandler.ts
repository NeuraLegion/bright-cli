import { bind, ExecuteScript, ForwardResponse, Handler } from '../Bus';
import { RequestExecutor, Script, ScriptResult } from '../RequestExecutor';

@bind(ExecuteScript)
export class SendRequestHandler
  implements Handler<ExecuteScript, ForwardResponse> {
  constructor(private readonly requestExecutor: RequestExecutor) {}

  public async handle(event: ExecuteScript): Promise<ForwardResponse> {
    console.log(event);
    const response: ScriptResult = await this.requestExecutor.execute(
      new Script(event)
    );

    return new ForwardResponse(
      response.status,
      response.headers,
      response.body,
      response.message,
      response.errorCode
    );
  }
}

import { bind, Handler } from '../Bus';
import { Request } from '../RequestExecutor';
import { ExecuteScript, ForwardResponse } from './Events';
import { RepeaterCommandHub } from '../Repeater';
import { inject, injectable } from 'tsyringe';

@injectable()
@bind(ExecuteScript)
export class SendRequestHandler
  implements Handler<ExecuteScript, ForwardResponse>
{
  constructor(
    @inject(RepeaterCommandHub)
    private readonly commandHub: RepeaterCommandHub
  ) {}

  public async handle(event: ExecuteScript): Promise<ForwardResponse> {
    const response = await this.commandHub.sendRequest(
      new Request({ ...event, correlationIdRegex: event.correlation_id_regex })
    );

    const {
      statusCode,
      message,
      errorCode,
      body,
      headers,
      protocol,
      encoding
    } = response;

    return new ForwardResponse(
      protocol,
      body,
      headers,
      statusCode,
      errorCode,
      message,
      encoding
    );
  }
}

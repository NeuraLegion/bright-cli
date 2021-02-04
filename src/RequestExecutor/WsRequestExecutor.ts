import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Request } from './Request';
import { Protocol } from '../Handlers';
import { RequestExecutorOptions } from './HttpRequestExecutor';
import { inject, injectable } from 'tsyringe';
import WebSocket, { ErrorEvent, MessageEvent } from 'ws';

@injectable()
export class WsRequestExecutor implements RequestExecutor {
  public protocol: Protocol = Protocol.WS;

  constructor(
    @inject(RequestExecutorOptions)
    private readonly options: RequestExecutorOptions
  ) {}

  public async execute(options: Request): Promise<Response> {
    const client = new WebSocket(options.url, options.headers);

    client.onopen = () => {
      client.send(options.body);
    };

    const result = await Promise.race<Response>([
      new Promise<Response>(
        (resolve) =>
          (client.onmessage = (event: MessageEvent) =>
            resolve(
              new Response({
                protocol: this.protocol,
                body: event.data.toString()
              })
            ))
      ),
      new Promise<Response>(
        (resolve) =>
          (client.onerror = (event: ErrorEvent) =>
            resolve(
              new Response({
                protocol: this.protocol,
                message: event.message
              })
            ))
      ),
      new Promise<Response>((resolve) => {
        setTimeout(
          () =>
            resolve(
              new Response({
                protocol: this.protocol,
                message: 'Timeout exceed'
              })
            ),
          this.options.timeout
        );
      })
    ]);

    client.close();

    return result;
  }
}

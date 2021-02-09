import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Request } from './Request';
import { Protocol } from './Protocol';
import { RequestExecutorOptions } from './HttpRequestExecutor';
import { inject, injectable } from 'tsyringe';
import WebSocket from 'ws';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { parse } from 'url';
import { once } from 'events';
import { promisify } from 'util';
import { IncomingMessage } from 'http';

@injectable()
export class WsRequestExecutor implements RequestExecutor {
  private readonly agent?: SocksProxyAgent;

  get protocol(): Protocol {
    return Protocol.WS;
  }

  constructor(
    @inject(RequestExecutorOptions)
    private readonly options: RequestExecutorOptions
  ) {
    this.agent = this.options.proxyUrl
      ? new SocksProxyAgent({
          ...parse(this.options.proxyUrl)
        })
      : undefined;
  }

  public async execute(options: Request): Promise<Response> {
    let timeout: NodeJS.Timeout;
    let client: WebSocket;

    try {
      client = new WebSocket(options.url, {
        rejectUnauthorized: true,
        headers: this.normalizeHeaders(options.headers),
        timeout: this.options.timeout,
        agent: this.agent
      });

      const opened = once(client, 'open');
      const upgrate = once(client, 'upgrade');
      await opened;
      const [upgradeResponse]: [IncomingMessage] = await upgrate;

      await promisify(client.send.bind(client))(options.body);

      timeout = setTimeout(
        () =>
          client.emit(
            'error',
            Object.assign(new Error('Waiting frame has timed out'), {
              code: 'ETIMEDOUT'
            })
          ),
        this.options.timeout
      );

      const result = await Promise.race([
        once(client, 'message'),
        once(client, 'close')
      ]);

      let response:
        | { body: string; code?: number; message: string }
        | undefined;

      if (result.length) {
        const [data, reason]: [string | number, string | undefined] = result;
        const body = typeof data === 'string' ? data : undefined;
        const message = typeof data === 'number' ? reason : undefined;
        const code =
          typeof data === 'number' ? data : upgradeResponse.statusCode;

        response = {
          body,
          code,
          message
        };
      }

      return new Response({
        protocol: this.protocol,
        message: response.message,
        statusCode: response.code,
        headers: upgradeResponse.headers,
        body: response.body
      });
    } catch (err) {
      const message = err?.info ?? err.message;
      const errorCode = err?.code ?? err?.syscall;

      return new Response({
        message,
        errorCode,
        protocol: this.protocol
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (client?.readyState === client.OPEN) {
        client.close();
      }
    }
  }

  private normalizeHeaders(
    headers: Record<string, string | string[]>
  ): Record<string, string | string[]> {
    return Object.fromEntries(
      Object.entries(headers).filter(
        ([key, _]: [string, string | string[]]) =>
          !['sec-websocket-version', 'sec-websocket-key'].includes(
            key.trim().toLowerCase()
          )
      )
    );
  }
}

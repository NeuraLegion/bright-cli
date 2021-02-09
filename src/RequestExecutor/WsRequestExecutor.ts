import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Request } from './Request';
import { Protocol } from './Protocol';
import { RequestExecutorOptions } from './HttpRequestExecutor';
import { logger } from '../Utils';
import { inject, injectable } from 'tsyringe';
import WebSocket from 'ws';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { parse } from 'url';
import { once } from 'events';
import { promisify } from 'util';
import { IncomingMessage } from 'http';

interface WSMessage {
  body: string;
  code?: number;
}

@injectable()
export class WsRequestExecutor implements RequestExecutor {
  private readonly agent?: SocksProxyAgent;

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

  get protocol(): Protocol {
    return Protocol.WS;
  }

  public async execute(options: Request): Promise<Response> {
    let timeout: NodeJS.Timeout;
    let client: WebSocket;

    try {
      logger.debug('Executing HTTP request with following params: %j', options);

      client = new WebSocket(options.url, {
        agent: this.agent,
        rejectUnauthorized: true,
        timeout: this.options.timeout,
        headers: this.normalizeHeaders(options.headers)
      });

      const res: IncomingMessage = await this.connect(client);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await promisify(client.send.bind(client))(options.body);

      timeout = this.setTimeout(client);

      const msg = await this.consume(client);

      return new Response({
        protocol: this.protocol,
        statusCode: msg.code ?? res.statusCode,
        headers: res.headers,
        body: msg.body
      });
    } catch (err) {
      const message = err.info ?? err.message;
      const errorCode = err.code ?? err.syscall;

      logger.error('Error executing request: %s', options.url);
      logger.error('Cause: %s', message);

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
        client.close(1000);
      }
    }
  }

  private setTimeout(client: WebSocket): NodeJS.Timeout {
    const timeout = setTimeout(
      () =>
        client.emit(
          'error',
          Object.assign(new Error('Waiting frame has timed out'), {
            code: 'ETIMEDOUT'
          })
        ),
      this.options.timeout
    );

    timeout.unref();

    return timeout;
  }

  private async consume(client: WebSocket): Promise<WSMessage> {
    const result = (await Promise.race([
      once(client, 'message'),
      once(client, 'close')
    ])) as [string | number, string | undefined];

    let msg: WSMessage | undefined;

    if (result.length) {
      const [data, reason]: [string | number, string | undefined] = result;
      const body = typeof data === 'string' ? data : reason;
      const code = typeof data === 'number' ? data : undefined;

      msg = {
        body,
        code
      };
    }

    return msg;
  }

  private async connect(client: WebSocket): Promise<IncomingMessage> {
    const opening = once(client, 'open');
    const upgrading = once(client, 'upgrade') as Promise<[IncomingMessage]>;

    await opening;

    const [res]: [IncomingMessage] = await upgrading;

    return res;
  }

  private normalizeHeaders(
    headers: Record<string, string | string[]>
  ): Record<string, string | string[]> {
    return Object.entries(headers).reduce(
      (
        common: Record<string, string | string[]>,
        [key, value]: [string, string | string[]]
      ) => {
        if (
          !['sec-websocket-version', 'sec-websocket-key'].includes(
            key.trim().toLowerCase()
          )
        ) {
          common[key] = value;
        }

        return common;
      },
      {}
    );
  }
}

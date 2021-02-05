import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Request } from './Request';
import { Protocol } from '../Handlers';
import { RequestExecutorOptions } from './HttpRequestExecutor';
import { inject, injectable } from 'tsyringe';
import WebSocket from 'ws';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { parse } from 'url';
import { once } from 'events';
import { promisify } from 'util';
import { IncomingMessage } from 'http';

interface Timeout {
  timeoutCode: string;
}

interface Closed {
  closeCode: number;
  reason: string;
}

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
    try {
      const client = new WebSocket(options.url, {
        rejectUnauthorized: true,
        headers: options.headers,
        timeout: this.options.timeout,
        agent: this.agent
      });

      const opened = once(client, 'open');
      const upgrate = once(client, 'upgrade');
      await opened;
      const [upgradeResponse]: [IncomingMessage] = await upgrate;

      await new Promise<void>((resolve, reject) =>
        client.send(options.body, (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        })
      );

      const result = await Promise.race([
        once(client, 'message'),
        once(client, 'close').then((x) => ({ closeCode: x[0], reason: x[1] })),
        promisify(setTimeout)(this.options.timeout, { timeoutCode: 'ETIMEOUT' })
      ]);

      const timeout = result as Timeout;
      const closed = result as Closed;

      if (timeout.timeoutCode) {
        return new Response({
          protocol: this.protocol,
          headers: upgradeResponse.headers,
          errorCode: timeout.timeoutCode,
          message: 'Timeout exceed'
        });
      }

      if (closed.closeCode) {
        return new Response({
          protocol: this.protocol,
          headers: upgradeResponse.headers,
          statusCode: closed.closeCode,
          message: closed.reason
        });
      }

      if (client.readyState === client.OPEN) {
        client.close();
      }

      return new Response({
        protocol: this.protocol,
        headers: upgradeResponse.headers,
        body: result[0].toString()
      });
    } catch (err) {
      const message = err?.info ?? err.message;
      const errorCode = err?.code ?? err?.syscall;

      return new Response({
        message,
        errorCode,
        protocol: this.protocol
      });
    }
  }
}

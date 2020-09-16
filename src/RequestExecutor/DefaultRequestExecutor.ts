import { RequestExecutor } from './RequestExecutor';
import { ScriptResult } from './ScriptResult';
import { Script } from './Script';
import logger from '../Utils/Logger';
import { Helpers } from '../Utils/Helpers';
import request from 'request-promise';
import { Response } from 'request';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { parse } from 'url';
import { OutgoingMessage } from 'http';

export class DefaultRequestExecutor implements RequestExecutor {
  private readonly agent?: SocksProxyAgent;

  constructor(
    private readonly options: {
      timeout?: number;
      proxyUrl?: string;
      headers?: Record<string, string | string[]>;
    }
  ) {
    this.agent = this.options.proxyUrl
      ? new SocksProxyAgent({
          ...parse(this.options.proxyUrl)
        })
      : undefined;
  }

  public async execute(script: Script): Promise<ScriptResult> {
    try {
      const rawHeaders: Record<string, string | string[]> = {
        ...script.headers,
        ...this.options.headers
      };
      const response: Response = await request({
        gzip: true,
        url: Helpers.encodeURL(script.url),
        strictSSL: false,
        agent: this.agent,
        body: script.body,
        method: script.method?.toUpperCase(),
        timeout: this.options.timeout,
        resolveWithFullResponse: true,
        followRedirect: false
      }).on('request', (req: OutgoingMessage) =>
        this.setHeaders(req, rawHeaders)
      );

      return new ScriptResult({
        status: response.statusCode,
        headers: response.headers,
        body: response.body
      });
    } catch (err) {
      if (err.response) {
        const { response } = err;

        return new ScriptResult({
          status: response.statusCode,
          headers: response.headers,
          body: response.body
        });
      }

      const message = err.cause?.message ?? err.message;
      const errorCode = err.cause?.code ?? err.error?.syscall;

      logger.error(
        'Error executing request: "%s %s HTTP/1.1"',
        script.method,
        script.url
      );
      logger.error('Cause: %s', message);

      return new ScriptResult({
        message,
        errorCode
      });
    }
  }

  private setHeaders(
    req: OutgoingMessage,
    rawHeaders: Record<string, string | string[]>
  ): void {
    const symbols: symbol[] = Object.getOwnPropertySymbols(req);
    const kOutHeaders: symbol = symbols.find(
      (item) => item.toString() === 'Symbol(kOutHeaders)'
    );

    if (!req.headersSent && kOutHeaders && rawHeaders) {
      const headers = (req[kOutHeaders] =
        req[kOutHeaders] ?? Object.create(null));

      this.mergeHeaders(rawHeaders, headers);
    }
  }

  private mergeHeaders(
    src: Record<string, string | string[]>,
    dest: Record<string, [string, string | string[]]>
  ) {
    Object.entries(src).forEach(([key, value]: [string, string | string[]]) => {
      if (key) {
        dest[key.toLowerCase()] = [key, value ?? ''];
      }
    });
  }
}

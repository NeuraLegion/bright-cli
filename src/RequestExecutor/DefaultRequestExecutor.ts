import { RequestExecutor } from './RequestExecutor';
import { ScriptResult } from './ScriptResult';
import { Script } from './Script';
import logger from '../Utils/Logger';
import { Helpers } from '../Utils/Helpers';
import request from 'request-promise';
import { Response } from 'request';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { parse } from 'url';

export class DefaultRequestExecutor implements RequestExecutor {
  private readonly agent?: SocksProxyAgent;

  constructor(
    private readonly options: {
      maxRedirects?: number;
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
      const response: Response = await request({
        gzip: true,
        url: Helpers.encodeURL(script.url),
        strictSSL: false,
        agent: this.agent,
        body: script.body,
        method: script.method?.toUpperCase(),
        headers: { ...script.headers, ...this.options.headers },
        timeout: this.options.timeout,
        resolveWithFullResponse: true,
        maxRedirects: this.options.maxRedirects
      });

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
}

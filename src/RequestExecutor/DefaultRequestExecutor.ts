import { RequestExecutor } from './RequestExecutor';
import { ScriptResult } from './ScriptResult';
import { Script } from './Script';
import request from 'request-promise';
import { Response } from 'request';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { injectable } from 'inversify';
import { parse } from 'url';

@injectable()
export class DefaultRequestExecutor implements RequestExecutor {
  private readonly agent?: SocksProxyAgent;

  constructor(
    private readonly options: {
      maxRedirects?: number;
      timeout?: number;
      proxyUrl?: string;
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
        url: script.url,
        strictSSL: false,
        agent: this.agent,
        body: script.body,
        method: script.method,
        headers: script.headers,
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
      const message = err.cause?.message ?? err.message;
      const errorCode = err.cause?.code ?? err.error?.syscall;

      console.error(
        'Error executing request: "%s %s HTTP/1.1"',
        script.method,
        script.url
      );
      console.error('Cause: %s', message);

      return new ScriptResult({
        message,
        errorCode
      });
    }
  }
}

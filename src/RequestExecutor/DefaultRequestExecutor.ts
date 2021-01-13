import { RequestExecutor } from './RequestExecutor';
import { ScriptResult } from './ScriptResult';
import { Script, ScriptOptions } from './Script';
import logger from '../Utils/Logger';
import { VirtualScripts } from '../Scripts';
import request from 'request-promise';
import { Response } from 'request';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { parse, URL } from 'url';
import { OutgoingMessage } from 'http';

type ScriptEntrypoint = (
  options: ScriptOptions
) => Promise<ScriptOptions> | ScriptOptions;

export class DefaultRequestExecutor implements RequestExecutor {
  private readonly DEFAULT_SCRIPT_ENTRYPOINT = 'handle';
  private readonly agent?: SocksProxyAgent;

  constructor(
    private readonly virtualScripts: VirtualScripts,
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
      const options = await this.transformScript(script);
      const response = await this.request(options);

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

  private async request(script: Script): Promise<Response> {
    const rawHeaders: Record<string, string | string[]> = {
      ...script.headers,
      ...this.options.headers
    };

    return request({
      agent: this.agent,
      body: script.body,
      followRedirect: false,
      gzip: true,
      method: script.method,
      resolveWithFullResponse: true,
      strictSSL: false,
      timeout: this.options.timeout,
      url: script.url
    }).on('request', (req: OutgoingMessage) =>
      this.setHeaders(req, rawHeaders)
    );
  }

  private async transformScript(script: Script): Promise<Script> {
    const { hostname } = new URL(script.url);

    const vm = this.virtualScripts.find(hostname);

    if (vm) {
      const result = await vm.exec<ScriptEntrypoint>(
        this.DEFAULT_SCRIPT_ENTRYPOINT,
        script
      );

      return new Script(result);
    }

    return script;
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

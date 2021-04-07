import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Request, RequestOptions } from './Request';
import { logger } from '../Utils';
import { VirtualScripts } from '../Scripts';
import { Protocol } from './Protocol';
import request from 'request-promise';
import { Response as IncomingResponse } from 'request';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { inject, injectable } from 'tsyringe';
import { parse, URL } from 'url';
import { OutgoingMessage } from 'http';

type ScriptEntrypoint = (
  options: RequestOptions
) => Promise<RequestOptions> | RequestOptions;

export interface RequestExecutorOptions {
  timeout?: number;
  proxyUrl?: string;
  headers?: Record<string, string | string[]>;
  certs?: Record<string, string>;
}

export const RequestExecutorOptions = Symbol('RequestExecutorOptions');

@injectable()
export class HttpRequestExecutor implements RequestExecutor {
  private readonly DEFAULT_SCRIPT_ENTRYPOINT = 'handle';
  private readonly agent?: SocksProxyAgent;

  get protocol(): Protocol {
    return Protocol.HTTP;
  }

  constructor(
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts,
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
      if (this.options.headers) {
        options.setHeaders(this.options.headers);
      }

      options = await this.transformScript(options);

      if (this.options.certs) {
        await options.setCerts(this.options.certs);
      }

      logger.debug('Executing HTTP request with following params: %j', options);

      const response = await this.request(options);

      return new Response({
        protocol: this.protocol,
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body
      });
    } catch (err) {
      if (err.response) {
        const { response } = err;

        return new Response({
          protocol: this.protocol,
          statusCode: response.statusCode,
          headers: response.headers,
          body: response.body
        });
      }

      const message = err.cause?.message ?? err.message;
      const errorCode = err.cause?.code ?? err.error?.syscall;

      logger.error(
        'Error executing request: "%s %s HTTP/1.1"',
        options.method,
        options.url
      );
      logger.error('Cause: %s', message);

      return new Response({
        protocol: this.protocol,
        message,
        errorCode
      });
    }
  }

  private async request(options: Request): Promise<IncomingResponse> {
    return request({
      agentOptions: {
        ca: options.ca,
        pfx: options.pfx
      },
      agent: this.agent,
      body: options.body,
      followRedirect: false,
      gzip: true,
      method: options.method,
      resolveWithFullResponse: true,
      rejectUnauthorized: false,
      timeout: this.options.timeout,
      url: options.url
    }).on('request', (req: OutgoingMessage) => this.setHeaders(req, options));
  }

  /**
   * Allows to attack headers. Node.js does not accept any other characters
   * which violate [rfc7230](https://tools.ietf.org/html/rfc7230#section-3.2.6).
   * To override default behavior bypassing {@link OutgoingMessage.setHeader} method we have to set headers via internal symbol.
   */
  private setHeaders(req: OutgoingMessage, options: Request): void {
    const symbols: symbol[] = Object.getOwnPropertySymbols(req);
    const headersSymbol: symbol = symbols.find(
      // ADHOC: Node.js version < 12 uses "outHeadersKey" symbol to set headers
      (item) =>
        ['Symbol(kOutHeaders)', 'Symbol(outHeadersKey)'].includes(
          item.toString()
        )
    );

    if (!req.headersSent && headersSymbol && options.headers) {
      const headers = (req[headersSymbol] =
        req[headersSymbol] ?? Object.create(null));

      Object.entries(options.headers).forEach(
        ([key, value]: [string, string | string[]]) => {
          if (key) {
            headers[key.toLowerCase()] = [key, value ?? ''];
          }
        }
      );
    }
  }

  private async transformScript(script: Request): Promise<Request> {
    const { hostname } = new URL(script.url);

    const vm = this.virtualScripts.find(hostname);

    if (!vm) {
      return script;
    }

    const result = await vm.exec<ScriptEntrypoint>(
      this.DEFAULT_SCRIPT_ENTRYPOINT,
      script.toJSON()
    );

    return new Request(result);
  }
}

import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Request, RequestOptions } from './Request';
import { logger } from '../Utils';
import { VirtualScripts } from '../Scripts';
import { Protocol } from './Protocol';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { NormalizeZlibDeflateTransformStream } from '../Utils/NormalizeZlibDeflateTransformStream';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { inject, injectable } from 'tsyringe';
import { parse as parseMimetype } from 'content-type';
import { parse as parseUrl, URL } from 'url';
import http, { ClientRequest, IncomingMessage, OutgoingMessage } from 'http';
import https, {
  AgentOptions,
  RequestOptions as ClientRequestOptions
} from 'https';
import { once } from 'events';
import { Readable } from 'stream';
import {
  constants,
  createBrotliDecompress,
  createGunzip,
  createInflate
} from 'zlib';

type ScriptEntrypoint = (
  options: RequestOptions
) => Promise<RequestOptions> | RequestOptions;

type IncomingResponse = IncomingMessage & { body?: string };

@injectable()
export class HttpRequestExecutor implements RequestExecutor {
  private readonly DEFAULT_SCRIPT_ENTRYPOINT = 'handle';
  private readonly proxy?: SocksProxyAgent;
  private readonly httpAgent?: http.Agent;
  private readonly httpsAgent?: https.Agent;

  get protocol(): Protocol {
    return Protocol.HTTP;
  }

  constructor(
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts,
    @inject(RequestExecutorOptions)
    private readonly options: RequestExecutorOptions
  ) {
    if (this.options.proxyUrl) {
      this.proxy = new SocksProxyAgent({
        ...parseUrl(this.options.proxyUrl)
      });
    }

    if (this.options.reuseConnection) {
      const agentOptions: AgentOptions = {
        keepAlive: true,
        maxSockets: 100,
        timeout: this.options.timeout
      };

      this.httpsAgent = new https.Agent(agentOptions);
      this.httpAgent = new http.Agent(agentOptions);
    }
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

      const { cause } = err;
      const { message, code, syscall, name } = cause ?? err;
      const errorCode = code ?? syscall ?? name;

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
    let timer: NodeJS.Timeout | undefined;
    let res!: IncomingMessage;

    try {
      const req = this.createRequest(options);

      process.nextTick(() => req.end(options.body));
      timer = this.setTimeout(req);

      [res] = (await once(req, 'response')) as [IncomingMessage];
    } finally {
      clearTimeout(timer);
    }

    return this.truncateResponse(res);
  }

  private createRequest(request: Request): ClientRequest {
    const protocol = request.url.startsWith('https') ? https : http;
    const outgoingMessage = protocol.request(
      this.createRequestOptions(request)
    );
    this.setHeaders(outgoingMessage, request);

    if (!outgoingMessage.hasHeader('accept-encoding')) {
      outgoingMessage.setHeader('accept-encoding', 'gzip, deflate');
    }

    return outgoingMessage;
  }

  private setTimeout(req: ClientRequest): NodeJS.Timeout | undefined {
    if (typeof this.options.timeout === 'number') {
      return setTimeout(
        () => req.destroy(new Error('Waiting response has timed out')),
        this.options.timeout
      );
    }
  }

  private createRequestOptions(request: Request): ClientRequestOptions {
    const {
      auth,
      hostname,
      port,
      hash = '',
      pathname = '/',
      search = ''
    } = parseUrl(request.url);
    const path = `${pathname ?? '/'}${search ?? ''}${hash ?? ''}`;
    const agent = this.getRequestAgent(request);

    return {
      hostname,
      port,
      path,
      auth,
      agent,
      ca: request.ca,
      pfx: request.pfx,
      passphrase: request.passphrase,
      method: request.method,
      timeout: this.options.timeout,
      rejectUnauthorized: false
    };
  }

  private getRequestAgent(options: Request) {
    return (
      this.proxy ?? (options.secureEndpoint ? this.httpsAgent : this.httpAgent)
    );
  }

  private async truncateResponse(
    res: IncomingResponse
  ): Promise<IncomingResponse> {
    if (this.responseHasNoBody(res)) {
      logger.debug('The response does not contain any body.');

      res.body = '';

      return res;
    }

    const type = this.parseContentType(res);
    const maxBodySize = this.options.maxContentLength * 1024;
    const requiresTruncating = !this.options.whitelistMimes?.some(
      (mime: string) => type.startsWith(mime)
    );

    const body = await this.parseBody(res, { maxBodySize, requiresTruncating });

    res.body = body.toString();
    res.headers['content-length'] = String(body.byteLength);

    return res;
  }

  private parseContentType(res: IncomingMessage): string {
    let type = res.headers['content-type'] || 'text/plain';

    try {
      ({ type } = parseMimetype(type));
    } catch {
      // noop
    }

    return type;
  }

  private unzipBody(response: IncomingMessage): Readable {
    let body: Readable = response;

    if (!this.responseHasNoBody(response)) {
      let contentEncoding = response.headers['content-encoding'] || 'identity';
      contentEncoding = contentEncoding.trim().toLowerCase();

      // Always using Z_SYNC_FLUSH is what cURL does.
      const zlibOptions = {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      };

      switch (contentEncoding) {
        case 'gzip':
          body = response.pipe(createGunzip(zlibOptions));
          break;
        case 'deflate':
          body = response
            .pipe(new NormalizeZlibDeflateTransformStream())
            .pipe(createInflate(zlibOptions));
          break;
        case 'br':
          body = response.pipe(createBrotliDecompress());
          break;
      }
    }

    return body;
  }

  private responseHasNoBody(response: IncomingMessage): boolean {
    return (
      response.method === 'HEAD' ||
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (response.statusCode! >= 100 && response.statusCode! < 200) ||
      response.statusCode === 204 ||
      response.statusCode === 304
    );
  }

  private async parseBody(
    res: IncomingMessage,
    options: { maxBodySize: number; requiresTruncating: boolean }
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chuck of this.unzipBody(res)) {
      chunks.push(chuck);
    }

    let body = Buffer.concat(chunks);

    const truncated =
      this.options.maxContentLength !== -1 &&
      body.byteLength > options.maxBodySize &&
      options.requiresTruncating;

    if (truncated) {
      logger.debug(
        'Truncate original response body to %i bytes',
        options.maxBodySize
      );

      body = body.slice(0, options.maxBodySize);
    }

    return body;
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
            headers[key.toLowerCase()] = [key.toLowerCase(), value ?? ''];
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

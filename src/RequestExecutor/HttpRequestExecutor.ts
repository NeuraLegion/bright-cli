import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Request, RequestOptions } from './Request';
import { logger, ProxyFactory } from '../Utils';
import { VirtualScripts } from '../Scripts';
import { Protocol } from './Protocol';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { NormalizeZlibDeflateTransformStream } from '../Utils/NormalizeZlibDeflateTransformStream';
import { inject, injectable } from 'tsyringe';
import iconv from 'iconv-lite';
import { safeParse } from 'fast-content-type-parse';
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

@injectable()
export class HttpRequestExecutor implements RequestExecutor {
  private readonly DEFAULT_SCRIPT_ENTRYPOINT = 'handle';
  private readonly httpProxyAgent?: http.Agent;
  private readonly httpsProxyAgent?: https.Agent;
  private readonly httpAgent?: http.Agent;
  private readonly httpsAgent?: https.Agent;

  get protocol(): Protocol {
    return Protocol.HTTP;
  }

  constructor(
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts,
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(RequestExecutorOptions)
    private readonly options: RequestExecutorOptions
  ) {
    if (this.options.proxyUrl) {
      ({ https: this.httpsProxyAgent, http: this.httpProxyAgent } =
        this.proxyFactory.createProxy({ proxyUrl: this.options.proxyUrl }));
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

      const { res, body } = await this.request(options);

      return new Response({
        body,
        protocol: this.protocol,
        statusCode: res.statusCode,
        headers: res.headers,
        encoding: options.encoding
      });
    } catch (err) {
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
        message,
        errorCode,
        protocol: this.protocol
      });
    }
  }

  private async request(options: Request) {
    let timer: NodeJS.Timeout | undefined;
    let res!: IncomingMessage;

    try {
      const req = this.createRequest(options);

      process.nextTick(() =>
        req.end(
          options.encoding
            ? iconv.encode(options.body, options.encoding)
            : options.body
        )
      );
      timer = this.setTimeout(req, options.timeout);

      [res] = (await once(req, 'response')) as [IncomingMessage];
    } finally {
      clearTimeout(timer);
    }

    return this.truncateResponse(options, res);
  }

  private createRequest(request: Request): ClientRequest {
    const protocol = request.secureEndpoint ? https : http;
    const outgoingMessage = protocol.request(
      this.createRequestOptions(request)
    );
    this.setHeaders(outgoingMessage, request);

    if (!outgoingMessage.hasHeader('accept-encoding')) {
      outgoingMessage.setHeader('accept-encoding', 'gzip, deflate');
    }

    return outgoingMessage;
  }

  private setTimeout(
    req: ClientRequest,
    timeout?: number
  ): NodeJS.Timeout | undefined {
    timeout ??= this.options.timeout;
    if (typeof timeout === 'number') {
      return setTimeout(
        () => req.destroy(new Error('Waiting response has timed out')),
        timeout
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
    const timeout = request.timeout ?? this.options.timeout;

    return {
      hostname,
      port,
      path,
      auth,
      agent,
      timeout,
      ca: request.ca,
      pfx: request.pfx,
      passphrase: request.passphrase,
      method: request.method,
      rejectUnauthorized: false
    };
  }

  private getRequestAgent(options: Request) {
    return options.secureEndpoint
      ? this.httpsProxyAgent ?? this.httpsAgent
      : this.httpProxyAgent ?? this.httpAgent;
  }

  private async truncateResponse(
    { decompress, encoding, maxContentSize }: Request,
    res: IncomingMessage
  ) {
    if (this.responseHasNoBody(res)) {
      logger.debug('The response does not contain any body.');

      return { res, body: '' };
    }

    const contentType = this.parseContentType(res);
    const { type } = contentType;
    const requiresTruncating = !this.options.whitelistMimes?.some(
      (mime: string) => type.startsWith(mime)
    );

    const maxBodySize =
      (maxContentSize ?? this.options.maxContentLength) * 1024;
    const body = await this.parseBody(res, {
      maxBodySize,
      requiresTruncating,
      decompress
    });

    res.headers['content-length'] = body.byteLength.toFixed();

    if (decompress) {
      delete res.headers['content-encoding'];
    }

    return { res, body: iconv.decode(body, encoding ?? contentType.encoding) };
  }

  private parseContentType(res: IncomingMessage): {
    type: string;
    encoding: string;
  } {
    const contentType =
      res.headers['content-type'] || 'application/octet-stream';
    const {
      type,
      parameters: { charset }
    } = safeParse(contentType);

    let encoding: string | undefined = charset;

    if (!encoding || !iconv.encodingExists(encoding)) {
      encoding = 'utf-8';
    }

    return { type, encoding };
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
    options: {
      maxBodySize: number;
      requiresTruncating: boolean;
      decompress: boolean;
    }
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const stream = options.decompress ? this.unzipBody(res) : res;

    for await (const chuck of stream) {
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

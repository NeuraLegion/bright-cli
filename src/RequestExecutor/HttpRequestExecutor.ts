import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Cert, Request, RequestOptions } from './Request';
import { Helpers, logger, ProxyFactory } from '../Utils';
import { VirtualScripts } from '../Scripts';
import { Protocol } from './Protocol';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { NormalizeZlibDeflateTransformStream } from '../Utils/NormalizeZlibDeflateTransformStream';
import { CertificatesCache } from './CertificatesCache';
import { inject, injectable } from 'tsyringe';
import iconv from 'iconv-lite';
import { safeParse } from 'fast-content-type-parse';
import { parse as parseUrl } from 'node:url';
import http, {
  ClientRequest,
  IncomingMessage,
  OutgoingMessage
} from 'node:http';
import https, {
  AgentOptions,
  RequestOptions as ClientRequestOptions
} from 'node:https';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import {
  constants,
  createBrotliDecompress,
  createGunzip,
  createInflate
} from 'node:zlib';

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
  private readonly proxyDomains?: RegExp[];
  private readonly proxyDomainsBypass?: RegExp[];

  get protocol(): Protocol {
    return Protocol.HTTP;
  }

  constructor(
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts,
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(RequestExecutorOptions)
    private readonly options: RequestExecutorOptions,
    @inject(CertificatesCache)
    private readonly certificatesCache: CertificatesCache
  ) {
    if (this.options.proxyUrl) {
      ({ httpsAgent: this.httpsProxyAgent, httpAgent: this.httpProxyAgent } =
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

    if (this.options.proxyDomains && this.options.proxyDomainsBypass) {
      throw new Error(
        'cannot use both proxyDomains and proxyDomainsBypass at the same time'
      );
    }

    if (this.options.proxyDomains) {
      this.proxyDomains = this.options.proxyDomains.map((domain) =>
        Helpers.wildcardToRegExp(domain)
      );
    }

    if (this.options.proxyDomainsBypass) {
      this.proxyDomainsBypass = this.options.proxyDomainsBypass.map((domain) =>
        Helpers.wildcardToRegExp(domain)
      );
    }
  }

  public async execute(options: Request): Promise<Response> {
    try {
      if (this.options.headers) {
        options.setHeaders(this.options.headers);
      }

      options = await this.transformScript(options);

      const targetCerts: Cert[] | undefined = this.options.certs
        ? this.certificatesForRequest(options)
        : undefined;

      if (targetCerts === undefined || targetCerts.length === 0) {
        // We may have https and http targets connected with same repeater,
        // or certificates may not be necessary.
        // If certificates not found try request anyway.
        logger.debug(
          'Executing HTTP request with following params: %j',
          options
        );

        return await this.tryRequest(options);
      }

      return await this.tryRequestWithCertificates(options, targetCerts);
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
        () =>
          req.destroy(
            Object.assign(new Error('Waiting response has timed out'), {
              code: 'ETIMEDOUT'
            })
          ),
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
    // do not use proxy for domains that are not in the list
    if (
      this.proxyDomains &&
      !this.proxyDomains.some((domain) =>
        domain.test(parseUrl(options.url).hostname)
      )
    ) {
      logger.debug("Not using proxy for URL '%s'", options.url);

      return options.secureEndpoint ? this.httpsAgent : this.httpAgent;
    }

    // do not use proxy for domains that are in the bypass list
    if (
      this.proxyDomainsBypass &&
      this.proxyDomainsBypass.some((domain) =>
        domain.test(parseUrl(options.url).hostname)
      )
    ) {
      logger.debug("Bypassing proxy for URL '%s'", options.url);

      return options.secureEndpoint ? this.httpsAgent : this.httpAgent;
    }

    return options.secureEndpoint
      ? this.httpsProxyAgent ?? this.httpsAgent
      : this.httpProxyAgent ?? this.httpAgent;
  }

  private async truncateResponse(
    { decompress, encoding, maxContentSize, url }: Request,
    res: IncomingMessage
  ) {
    if (this.responseHasNoBody(res)) {
      logger.debug('The response does not contain any body.');

      return { res, body: '' };
    }

    const contentType = this.parseContentType(res);
    const { type } = contentType;
    const whiteListedMimeType = this.options.whitelistMimes?.find((mime) =>
      type.startsWith(mime.type)
    );
    const maxSize = whiteListedMimeType
      ? this.options.maxBodySize
      : (maxContentSize ?? this.options.maxContentLength) * 1024;

    const { body, transform } = await this.parseBody(res, {
      decompress,
      allowTruncation:
        !whiteListedMimeType || whiteListedMimeType.allowTruncation,
      maxSize
    });

    if (transform && whiteListedMimeType) {
      logger.error(
        `The original response body for URL %s was %s because it exceeded the maximum allowed size of %i bytes.`,
        url,
        transform,
        maxSize
      );
    }

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
      maxSize: number;
      allowTruncation: boolean;
      decompress: boolean;
    }
  ): Promise<{ body: Buffer; transform: 'truncated' | 'omitted' | false }> {
    const chunks: Buffer[] = [];
    const stream = options.decompress ? this.unzipBody(res) : res;

    for await (const chuck of stream) {
      chunks.push(chuck);
    }

    let body = Buffer.concat(chunks);
    let transform: 'truncated' | 'omitted' | false = false;

    if (body.byteLength > options.maxSize) {
      const result = this.truncateBody(body, options);
      body = result.body;
      transform = result.transform;
    }

    return { body, transform };
  }

  private truncateBody(
    body: Buffer,
    options: {
      maxSize: number;
      allowTruncation: boolean;
    }
  ): { body: Buffer; transform: 'truncated' | 'omitted' } {
    if (options.allowTruncation) {
      logger.debug(
        'Truncate original response body to %i bytes',
        options.maxSize
      );

      return {
        body: body.subarray(0, options.maxSize),
        transform: 'truncated'
      };
    } else {
      logger.debug(
        'Omit original response body because body is bigger than %i bytes',
        options.maxSize
      );

      return {
        body: Buffer.alloc(0),
        transform: 'omitted'
      };
    }
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

    if (!options.keepAlive) {
      req.setHeader('Connection', 'close');
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
      {
        ...script.toJSON(),
        body: script.encoding
          ? iconv.encode(script.body, script.encoding).toString()
          : script.body
      }
    );

    return new Request(result);
  }

  private certificatesForRequest(request: Request): Cert[] {
    const cachedCertificate = this.certificatesCache.get(request);
    if (cachedCertificate) {
      return [cachedCertificate];
    }

    const requestUrl = new URL(request.url);
    const port = Helpers.portFromURL(requestUrl);

    return this.options.certs.filter((cert: Cert) =>
      Helpers.matchHostnameAndPort(requestUrl.hostname, port, cert)
    );
  }

  private async tryRequest(request: Request): Promise<Response | undefined> {
    const { res, body } = await this.request(request);

    logger.trace(
      'received following response for request %j: headers: %j body: %s',
      {
        url: request.url,
        protocol: this.protocol,
        method: request.method
      },
      {
        statusCode: res.statusCode,
        headers: res.headers
      },
      body.slice(0, 500).concat(body.length > 500 ? '...' : '')
    );

    return new Response({
      body,
      protocol: this.protocol,
      statusCode: res.statusCode,
      headers: res.headers,
      encoding: request.encoding
    });
  }

  private async tryRequestWithCertificate(
    request: Request,
    cert: Cert
  ): Promise<Response | undefined> {
    await request.setCert(cert);

    // eslint-disable-next-line @typescript-eslint/return-await
    return await this.tryRequest(request);
  }

  private async tryRequestWithCertificates(
    request: Request,
    certs: Cert[]
  ): Promise<Response> {
    const requestsWithCerts: Promise<Response>[] = certs.map(
      async (cert: Cert) => {
        logger.debug(
          'Executing HTTP request with following params: %j',
          request
        );
        try {
          const response = await this.tryRequestWithCertificate(request, cert);
          this.certificatesCache.add(request, cert);

          return response;
        } catch (error) {
          const msg = Helpers.isTlsCertError(error)
            ? `Failed to do successful request with certificate ${cert.path}. It will be excluded from list of known certificates.`
            : `Unexpected error occured during request: ${error}`;
          logger.warn(msg);
          throw Error(msg);
        }
      }
    );

    // Important to wait for valid response.
    // eslint-disable-next-line @typescript-eslint/return-await
    return await Promise.any(requestsWithCerts);
  }
}

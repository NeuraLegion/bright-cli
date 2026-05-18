import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Cert, Request, RequestOptions } from './Request';
import { Helpers, logger } from '../Utils';
import { VirtualScripts } from '../Scripts';
import { Protocol } from './Protocol';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
import { inject, injectable } from 'tsyringe';
import iconv from 'iconv-lite';
import { safeParse } from 'fast-content-type-parse';
import { Curl, CurlFeature, HeaderInfo, Multi } from '@brightsec/node-libcurl';
import { parse as parseUrl } from 'node:url';

type ScriptEntrypoint = (
  options: RequestOptions
) => Promise<RequestOptions> | RequestOptions;

@injectable()
export class HttpRequestExecutor implements RequestExecutor {
  private readonly KEEP_ALIVE_IDLE_TIMEOUT = 60;
  private readonly MAX_HOST_CONNECTIONS = 100;
  private readonly DEFAULT_SCRIPT_ENTRYPOINT = 'handle';
  private readonly proxyDomains?: RegExp[];
  private readonly proxyDomainsBypass?: RegExp[];
  private readonly sharedMulti: Multi;

  get protocol(): Protocol {
    return Protocol.HTTP;
  }

  constructor(
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts,
    @inject(RequestExecutorOptions)
    private readonly options: RequestExecutorOptions,
    @inject(CertificatesCache)
    private readonly certificatesCache: CertificatesCache,
    @inject(CertificatesResolver)
    private readonly certificatesResolver: CertificatesResolver
  ) {
    if (
      this.options.proxyDomains?.length &&
      this.options.proxyDomainsBypass?.length
    ) {
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

    this.sharedMulti = new Multi();

    if (this.options.reuseConnection) {
      this.sharedMulti.setOpt(
        'MAX_HOST_CONNECTIONS',
        this.MAX_HOST_CONNECTIONS
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
        ? this.certificatesResolver.resolve(options, this.options.certs)
        : undefined;

      if (targetCerts === undefined || targetCerts.length === 0) {
        logger.debug(
          'Executing HTTP request with following params: %j',
          options
        );

        return await this.executeRequest(options);
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

  private request(options: Request): Promise<{
    statusCode: number;
    headers: Record<string, string | string[]>;
    rawBody: Buffer;
    ttfb: number;
  }> {
    return new Promise((resolve, reject) => {
      const curl = new Curl();

      this.configureCurl(curl, options);

      curl.on(
        'end',
        (statusCode: number, rawBody: Buffer, rawHeaders: HeaderInfo[]) => {
          const ttfbUs = curl.getInfo('STARTTRANSFER_TIME_T') as number;
          const ttfb = Math.round(ttfbUs / 1000);

          const headers = this.parseCurlHeaders(rawHeaders);

          setImmediate(() => curl.close());

          resolve({ statusCode, headers, rawBody, ttfb });
        }
      );

      curl.on('error', (err: Error) => {
        setImmediate(() => curl.close());
        reject(err);
      });

      curl.perform();
    });
  }

  private configureCurl(curl: Curl, options: Request): void {
    curl.enable(CurlFeature.NoDataParsing);

    const { protocol, host, auth } = parseUrl(options.url);
    curl.setOpt('URL', `${protocol}//${host}`);

    if (auth) {
      curl.setOpt('USERPWD', auth);
    }

    const rawPath = this.buildRawPath(options.url);
    curl.setOpt('REQUEST_TARGET', rawPath);
    // Prevent libcurl from normalising (percent-encoding) the path.
    curl.setOpt('PATH_AS_IS', true);
    curl.setOpt('SSL_VERIFYPEER', false);
    curl.setOpt('SSL_VERIFYHOST', 0);
    curl.setOpt('FOLLOWLOCATION', false);

    this.applyCurlBody(curl, options);
    this.applyCurlTls(curl, options);
    this.applyCurlTimeout(curl, options);
    this.applyCurlHeaders(curl, options);

    if (this.options.reuseConnection) {
      curl.setOpt('TCP_KEEPALIVE', 1);
      curl.setOpt('TCP_KEEPIDLE', this.KEEP_ALIVE_IDLE_TIMEOUT);
      curl.setMulti(this.sharedMulti);
    } else {
      curl.setOpt('FRESH_CONNECT', 1);
      curl.setOpt('FORBID_REUSE', 1);
    }

    const proxyUrl = this.resolveProxy(options);

    if (proxyUrl) {
      curl.setOpt('PROXY', proxyUrl);
    }

    curl.setOpt('CUSTOMREQUEST', options.method);
  }

  /**
   * Extracts the raw path+query+hash from a URL string without any
   * percent-encoding normalisation.
   */
  private buildRawPath(url: string): string {
    const separatorIndex = url.indexOf('://');
    const withoutProtocol =
      separatorIndex === -1 ? url : url.slice(separatorIndex + 3);
    const pathStart = withoutProtocol.search(/[/?#]/);

    if (pathStart === -1) return '/';

    return withoutProtocol[pathStart] === '/'
      ? withoutProtocol.slice(pathStart)
      : `/${withoutProtocol.slice(pathStart)}`;
  }

  private applyCurlBody(curl: Curl, options: Request): void {
    if (!options.body) return;

    const bodyBuffer = options.encoding
      ? iconv.encode(options.body, options.encoding)
      : Buffer.from(options.body);

    curl.setOpt('POSTFIELDS', bodyBuffer.toString());
    curl.setOpt('POSTFIELDSIZE', bodyBuffer.length);
  }

  private applyCurlTls(curl: Curl, options: Request): void {
    if (options.ca) {
      curl.setOpt('CAINFO_BLOB', options.ca);
    }

    if (options.pfx) {
      curl.setOpt('SSLCERT_BLOB', options.pfx);
      curl.setOpt('SSLCERTTYPE', 'P12');

      if (options.passphrase) {
        curl.setOpt('KEYPASSWD', options.passphrase);
      }
    }
  }

  private applyCurlTimeout(curl: Curl, options: Request): void {
    const timeout = options.timeout ?? this.options.timeout;

    if (typeof timeout === 'number') {
      curl.setOpt('TIMEOUT_MS', timeout);
    }
  }

  private applyCurlHeaders(curl: Curl, options: Request): void {
    const curlHeaders = this.buildCurlHeaders(options);

    // Suppress libcurl's default "User-Agent: node-libcurl/<version>" by
    // setting USERAGENT to an empty string. If the caller supplied their own
    // User-Agent it is already present in curlHeaders and takes precedence via
    // HTTPHEADER, which overrides USERAGENT for that header.
    curl.setOpt('USERAGENT', '');

    // When not reusing connections, explicitly tell the server to close the connection after this request
    const hasConnectionHeader =
      options.headers &&
      Object.keys(options.headers).some(
        (k) => k.toLowerCase() === 'connection'
      );
    if (!this.options.reuseConnection && !hasConnectionHeader) {
      curlHeaders.push('Connection: close');
    }

    if (options.decompress) {
      // Let libcurl handle decompression automatically.
      curl.setOpt('ACCEPT_ENCODING', '');
    } else {
      curlHeaders.push('Accept-Encoding: identity');
    }

    if (curlHeaders.length > 0) {
      curl.setOpt('HTTPHEADER', curlHeaders);
    }
  }

  private buildCurlHeaders(options: Request): string[] {
    const lines: string[] = [];
    const entries = options.headers ? Object.entries(options.headers) : [];

    for (const [key, value] of entries) {
      if (!key) continue;

      const values = Array.isArray(value) ? value : [value];

      // The Host header requires special handling: libcurl derives Host from
      // the URL by default, but a caller-supplied Host must be forwarded
      // verbatim — it may carry a security-test payload (e.g. Host injection).
      // Passing it via HTTPHEADER overrides libcurl's derived value on the wire.
      lines.push(...values.map((v) => `${key}: ${v ?? ''}`));
    }

    return lines;
  }

  private parseCurlHeaders(
    rawHeaders: HeaderInfo[]
  ): Record<string, string | string[]> {
    const lastHeaders = rawHeaders[rawHeaders.length - 1] ?? {};
    const result: Record<string, string | string[]> = {};

    for (const [key, val] of Object.entries(lastHeaders)) {
      if (key === 'result') continue;

      result[key.toLowerCase()] = val as string;
    }

    return result;
  }

  private resolveProxy(options: Request): string | undefined {
    const hostname = parseUrl(options.url).hostname;

    if (
      this.proxyDomains &&
      !this.proxyDomains.some((domain) => domain.test(hostname))
    ) {
      logger.debug("Not using proxy for URL '%s'", options.url);

      return undefined;
    }

    if (
      this.proxyDomainsBypass &&
      this.proxyDomainsBypass.some((domain) => domain.test(hostname))
    ) {
      logger.debug("Bypassing proxy for URL '%s'", options.url);

      return undefined;
    }

    return this.options.proxyUrl;
  }

  private truncateResponse(
    { decompress, encoding, maxContentSize, url }: Request,
    rawBody: Buffer,
    responseHeaders: Record<string, string | string[]>
  ): { body: string; headers: Record<string, string | string[]> } {
    const contentType = this.parseContentType(responseHeaders);
    const { type } = contentType;
    const whiteListedMimeType = this.options.whitelistMimes?.find((mime) =>
      type.startsWith(mime.type)
    );
    const maxSize = whiteListedMimeType
      ? this.options.maxBodySize
      : (maxContentSize ?? this.options.maxContentLength) * 1024;

    let body = rawBody;
    let transform: 'truncated' | 'omitted' | false = false;

    if (decompress) {
      // libcurl already decompressed the body when ACCEPT_ENCODING was set.
      // Remove the content-encoding header so consumers see the decoded body.
      delete responseHeaders['content-encoding'];
    }

    if (body.byteLength > maxSize) {
      const result = this.truncateBody(body, {
        maxSize,
        allowTruncation:
          !whiteListedMimeType || whiteListedMimeType.allowTruncation
      });
      body = result.body;
      transform = result.transform;
    }

    if (transform && whiteListedMimeType) {
      logger.error(
        `The original response body for URL %s was %s because it exceeded the maximum allowed size of %i bytes.`,
        url,
        transform,
        maxSize
      );
    }

    responseHeaders['content-length'] = body.byteLength.toFixed();

    return {
      body: iconv.decode(body, encoding ?? contentType.encoding),
      headers: responseHeaders
    };
  }

  private parseContentType(headers: Record<string, string | string[]>): {
    type: string;
    encoding: string;
  } {
    const contentType =
      (headers['content-type'] as string) || 'application/octet-stream';
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

  private responseHasNoBody(method: string, statusCode: number): boolean {
    return (
      method === 'HEAD' ||
      (statusCode >= 100 && statusCode < 200) ||
      statusCode === 204 ||
      statusCode === 304
    );
  }

  private truncateBody(
    body: Buffer,
    options: { maxSize: number; allowTruncation: boolean }
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

      return { body: Buffer.alloc(0), transform: 'omitted' };
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

  private async executeRequest(request: Request): Promise<Response> {
    const { statusCode, headers, rawBody, ttfb } = await this.request(request);

    logger.trace(
      'received following response for request %j: headers: %j body: %s',
      {
        url: request.url,
        protocol: this.protocol,
        method: request.method
      },
      { statusCode, headers },
      rawBody
        .slice(0, 500)
        .toString()
        .concat(rawBody.length > 500 ? '...' : '')
    );

    if (this.responseHasNoBody(request.method, statusCode)) {
      logger.debug('The response does not contain any body.');

      return new Response({
        body: '',
        ttfb,
        headers,
        protocol: this.protocol,
        statusCode
      });
    }

    const { body, headers: finalHeaders } = this.truncateResponse(
      request,
      rawBody,
      headers
    );

    return new Response({
      body,
      ttfb,
      encoding: request.encoding,
      headers: finalHeaders,
      protocol: this.protocol,
      statusCode
    });
  }

  private tryRequestWithCertificates(
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
          await request.loadCert(cert);

          const response = await this.executeRequest(request);
          this.certificatesCache.add(request, cert);

          return response;
        } catch (error) {
          const msg = Helpers.isTlsCertError(error)
            ? `Failed to do successful request with certificate ${cert.path}. It will be excluded from list of known certificates.`
            : `Unexpected error occured during request: ${error}`;
          logger.warn(msg);
          throw error;
        }
      }
    );

    // @ts-expect-error TS forces to use es2021
    return Promise.any(requestsWithCerts);
  }
}

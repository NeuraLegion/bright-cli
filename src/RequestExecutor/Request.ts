import { Helpers, logger } from '../Utils';
import { Protocol } from './Protocol';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { createSecureContext } from 'node:tls';

export interface RequestOptions {
  protocol: Protocol;
  url: string;
  headers?: Record<string, string | string[]>;
  method?: string;
  pfx?: Buffer | string;
  ca?: Buffer | string;
  body?: string;
  passphrase?: string;
  correlationIdRegex?: string | RegExp;
  encoding?: 'base64';
  maxContentSize?: number;
  timeout?: number;
  decompress?: boolean;
  keepAlive?: boolean;
}

export interface Cert {
  path: string;
  hostname: string;
  passphrase?: string;
  port?: string;
}

export class Request {
  public static readonly SINGLE_VALUE_HEADERS: ReadonlySet<string> =
    new Set<string>([
      'authorization',
      'content-disposition',
      'content-length',
      'content-type',
      'from',
      'host',
      'if-modified-since',
      'if-unmodified-since',
      'location',
      'max-forwards',
      'proxy-authorization',
      'referer',
      'user-agent'
    ]);

  public readonly protocol: Protocol;
  public readonly url: string;
  public readonly body?: string;
  public readonly correlationIdRegex?: RegExp;
  public readonly encoding?: 'base64';
  public readonly maxContentSize?: number;
  public readonly decompress?: boolean;
  public readonly timeout?: number;
  public readonly keepAlive?: boolean;

  private _method: string;

  get method(): string {
    return this._method;
  }

  private _headers?: Record<string, string | string[]>;

  get headers(): Readonly<Record<string, string | string[]>> {
    return this._headers;
  }

  private _ca?: Buffer;

  get ca() {
    return this._ca;
  }

  private _pfx?: Buffer;

  get pfx() {
    return this._pfx;
  }

  private _passphrase?: string;

  get passphrase() {
    return this._passphrase;
  }

  get secureEndpoint(): boolean {
    return this.url.startsWith('https');
  }

  constructor({
    protocol,
    method,
    url,
    body,
    ca,
    pfx,
    passphrase,
    timeout,
    correlationIdRegex,
    maxContentSize,
    encoding,
    decompress = true,
    headers = {},
    keepAlive
  }: RequestOptions) {
    this.protocol = protocol;
    this._method = method?.toUpperCase() ?? 'GET';

    this.validateUrl(url);
    this.url = url.trim();

    this.precheckBody(body);
    this.body = body;

    this.correlationIdRegex =
      this.normalizeCorrelationIdRegex(correlationIdRegex);

    this.setHeaders(headers);

    if (pfx) {
      this._pfx = Buffer.from(pfx);
    }

    if (ca) {
      this._ca = Buffer.from(ca);
    }

    this._passphrase = passphrase;
    this.encoding = encoding;
    this.timeout = timeout;
    this.maxContentSize = maxContentSize;
    this.decompress = !!decompress;
    this.keepAlive = keepAlive;
  }

  public setHeaders(headers: Record<string, string | string[]>): void {
    const mergedHeaders = {
      ...this._headers,
      ...headers
    };

    this._headers = Object.entries(mergedHeaders).reduce(
      (result, [field, value]: [string, string | string[]]) => {
        result[field] =
          Array.isArray(value) &&
          Request.SINGLE_VALUE_HEADERS.has(field.toLowerCase())
            ? value.join(', ')
            : value;

        return result;
      },
      {}
    );
  }

  public async setCerts(certs: Cert[]): Promise<void> {
    const url = new URL(this.url);

    const port =
      url.port ||
      (url.protocol === 'http:'
        ? '80'
        : url.protocol === 'https:'
        ? '443'
        : '');

    const cert: Cert | undefined = certs.find((x) =>
      this.matchHostnameAndPort(url.hostname, port, x)
    );

    if (!cert) {
      logger.warn(`Warning: certificate for ${url.hostname} not found.`);

      return;
    }

    logger.trace(`Using certificate for ${url}`, cert);

    await this.loadCert(cert);
  }

  public toJSON(): RequestOptions {
    return {
      protocol: this.protocol,
      url: this.url,
      body: this.body,
      method: this._method,
      headers: this._headers,
      passphrase: this._passphrase,
      ca: this._ca?.toString('utf8'),
      pfx: this._pfx?.toString('utf8'),
      correlationIdRegex: this.correlationIdRegex
    };
  }

  private validateUrl(url: string): void {
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL.');
    }
  }

  private precheckBody(body: string | undefined): void {
    if (body && typeof body !== 'string') {
      throw new Error('Body must be string.');
    }
  }

  private normalizeCorrelationIdRegex(
    correlationIdRegex: RegExp | string | undefined
  ): RegExp | undefined {
    if (correlationIdRegex) {
      try {
        return new RegExp(correlationIdRegex, 'i');
      } catch {
        throw new Error('Correlation id must be regular expression.');
      }
    }
  }

  private async loadCert({ path, passphrase }: Cert): Promise<void> {
    let cert: Buffer | undefined;

    try {
      cert = await readFile(path);
    } catch (e) {
      logger.warn(`Warning: certificate ${path} not found.`);
    }

    const ext = extname(path);
    const name = basename(path);

    switch (ext) {
      case '.pem':
      case '.crt':
      case '.ca':
        this._ca = cert;
        break;
      case '.pfx':
        this.assertPassphrase(name, cert, passphrase);
        this._pfx = cert;
        this._passphrase = passphrase;
        break;
      default:
        logger.warn(`Warning: certificate of type "${ext}" does not support.`);
    }
  }

  private matchHostnameAndPort(
    hostname: string,
    port: string,
    cert: Cert
  ): boolean {
    const hostNameMatch =
      cert.hostname === hostname ||
      Helpers.wildcardToRegExp(cert.hostname).test(hostname);

    if (!hostNameMatch) {
      return false;
    }

    if (!cert.port) {
      // ADHOC: hostNameMatch has been checked above and it's true
      return true;
    }

    return cert.port === port;
  }

  private assertPassphrase(
    name: string,
    pfx: Buffer,
    passphrase: string
  ): void {
    try {
      createSecureContext({ passphrase, pfx });
    } catch (e) {
      logger.warn(
        `Error Loading Certificate: Wrong passphrase for certificate ${name}.`
      );
    }
  }
}

import { Helpers, logger } from '../Utils';
import { URL } from 'url';
import { readFile } from 'fs';
import { extname } from 'path';
import { promisify } from 'util';

export interface RequestOptions {
  method?: string;
  url: string;
  headers: Record<string, string | string[]>;
  pfx?: Buffer | string;
  ca?: Buffer | string;
  body?: string;
  correlationIdRegex?: string | RegExp;
}

export class Request {
  public readonly url: string;
  public readonly body?: string;
  public readonly correlationIdRegex?: RegExp;

  private _method?: string;

  get method(): string {
    return this._method;
  }

  private _headers: Record<string, string | string[]>;

  get headers(): Record<string, string | string[]> {
    return this._headers;
  }

  private _ca?: Buffer;

  get ca(): Buffer {
    return this._ca;
  }

  private _pfx?: Buffer;

  get pfx(): Buffer {
    return this._pfx;
  }

  constructor({
    method,
    url,
    body,
    ca,
    pfx,
    correlationIdRegex,
    headers = {}
  }: RequestOptions) {
    this._method = method?.toUpperCase() ?? 'GET';

    if (!url) {
      throw new Error('Url must be declared explicitly.');
    }

    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL.');
    }

    this.url = Helpers.encodeURL(url);

    if (body && typeof body !== 'string') {
      throw new Error('Body must be string.');
    }

    this.body = body;

    if (correlationIdRegex) {
      try {
        this.correlationIdRegex = new RegExp(correlationIdRegex, 'i');
      } catch {
        // noop
      }
    }

    this._headers = headers;

    if (pfx) {
      this._pfx = Buffer.from(pfx);
    }

    if (ca) {
      this._ca = Buffer.from(ca);
    }
  }

  /**
   * Allows to attack headers. Node.js does not accept any other characters
   * which violate [rfc7230](https://tools.ietf.org/html/rfc7230#section-3.2.6).
   * To override default behavior bypassing {@link OutgoingMessage.setHeader} method we have to set headers via internal symbol.
   */
  public setHeaders(headers: Record<string, string | string[]>): void {
    this._headers = {
      ...this._headers,
      ...(headers ?? {})
    };
  }

  public async setCerts(certs: Record<string, string> = {}): Promise<void> {
    const { hostname } = new URL(this.url);
    const path = certs[hostname];

    if (!path) {
      logger.warn(`Warning: certificate for ${hostname} not found.`);

      return;
    }

    await this.loadCert(path);
  }

  public toJSON(): RequestOptions {
    return {
      url: this.url,
      body: this.body,
      method: this._method,
      headers: this._headers,
      ca: this._ca?.toString('utf8'),
      pfx: this._pfx?.toString('utf8'),
      correlationIdRegex: this.correlationIdRegex
    };
  }

  private async loadCert(path: string): Promise<void> {
    let cert: Buffer | undefined;

    try {
      cert = await promisify(readFile)(path);
    } catch (e) {
      logger.warn(`Warning: certificate ${path} not found.`);
    }

    const ext = extname(path);

    switch (ext) {
      case '.pem':
      case '.crt':
      case '.ca':
        this._ca = cert;
        break;
      case '.pfx':
        this._pfx = cert;
        break;
      default:
        logger.warn(`Warning: certificate of type "${ext}" does not support.`);
    }
  }
}

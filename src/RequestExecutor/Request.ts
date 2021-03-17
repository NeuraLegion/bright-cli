import { Helpers, logger } from '../Utils';
import { URL } from 'url';
import fs from 'fs';
import { extname } from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const fileExists = promisify(fs.access);

export interface RequestOptions {
  method?: string;
  url: string;
  headers: Record<string, string | string[]>;
  certs?: Record<string, string>;
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

  private _certs: Record<string, string>;

  get certs(): Readonly<Record<string, string>> {
    return this._certs;
  }

  constructor({
    method,
    url,
    body,
    correlationIdRegex,
    certs = {},
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

    this._certs = certs;
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

  public async appendCerts(certs: Record<string, string> = {}): Promise<void> {
    const { hostname } = new URL(this.url);
    const filePath = certs?.[hostname];
    if (!filePath) {
      logger.warn(`Warning: Certificate for ${hostname} not found.`);

      return;
    }

    await this.verifyCertificate(this.url, certs);
    this._certs = {
      [hostname]: certs[hostname]
    };
  }

  public async getCerts(): Promise<{ ca?: Buffer; pfx?: Buffer } | undefined> {
    const { hostname } = new URL(this.url);
    const filePath = this.certs?.[hostname];
    if (!filePath) {
      logger.warn(`Warning: Certificate for ${hostname} not found.`);

      return;
    }

    const extension = extname(filePath);
    switch (extension) {
      case '.pem':
      case '.crt':
      case '.ca':
        return {
          ca: await readFile(filePath)
        };
      case '.pfx':
        return {
          pfx: await readFile(filePath)
        };
      default:
        return;
    }
  }

  public toJSON(): RequestOptions {
    return {
      url: this.url,
      method: this._method,
      headers: this._headers,
      certs: this._certs,
      body: this.body,
      correlationIdRegex: this.correlationIdRegex
    };
  }

  private async verifyCertificate(
    url: string,
    certs: Record<string, string> = {}
  ): Promise<void> {
    const { hostname } = new URL(url);
    const filePath = certs?.[hostname];
    if (!filePath) {
      logger.warn(`Warning: Certificate for ${hostname} not found.`);

      return;
    }

    const AVAILABLE_CERTIFICATES = ['.pem', '.crt', '.ca', '.pfx'];
    const extension = filePath ? extname(filePath) : '';
    if (!AVAILABLE_CERTIFICATES.includes(extension)) {
      logger.warn(
        `Warning: Certificate of type ${extension} does not support.`
      );
    }
    try {
      await fileExists(filePath);

      return;
    } catch (e) {
      logger.warn(`Warning: Certificate ${e.path} not found.`);
    }
  }
}

import { Helpers } from '../Utils';
import { URL } from 'url';

export interface RequestOptions {
  method?: string;
  url: string;
  headers: Record<string, string | string[]>;
  body?: string;
}

export class Request {
  public readonly method?: string;
  public readonly url: string;
  public readonly body?: string;

  private _headers: Record<string, string | string[]>;

  get headers(): Record<string, string | string[]> {
    return this._headers;
  }

  constructor({ method, url, body, headers = {} }: RequestOptions) {
    if (!method) {
      throw new Error('Method must be declared explicitly.');
    }

    this.method = method?.toUpperCase();

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

    this._headers = headers;
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

  public toJSON(): RequestOptions {
    return {
      url: this.url,
      method: this.method,
      headers: this._headers,
      body: this.body
    };
  }
}

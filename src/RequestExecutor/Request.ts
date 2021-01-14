import { Helpers } from '../Utils';
import { URL } from 'url';
import { OutgoingMessage } from 'http';

export interface RequestOptions {
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
  body?: string;
}

export class Request {
  public readonly method: string;
  public readonly url: string;
  public readonly headers: Record<string, string | string[]>;
  public readonly body?: string;

  constructor({ method, url, body, headers = {} }: RequestOptions) {
    if (!method) {
      throw new Error('Method must be declared explicitly.');
    }

    this.method = method.toUpperCase();

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

    this.headers = headers;
  }

  /**
   * Allows to attack headers. Node.js does not accept any other characters
   * which violate [rfc7230](https://tools.ietf.org/html/rfc7230#section-3.2.6).
   * To override default behavior bypassing {@link OutgoingMessage.setHeader} method we have to set headers via internal symbol.
   */
  public setHeaders(
    req: OutgoingMessage,
    extraHeaders?: Record<string, string | string[]>
  ): void {
    const symbols: symbol[] = Object.getOwnPropertySymbols(req);
    const kOutHeaders: symbol = symbols.find(
      (item) => item.toString() === 'Symbol(kOutHeaders)'
    );

    const rawHeaders: Record<string, string | string[]> = {
      ...this.headers,
      ...(extraHeaders ?? {})
    };

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

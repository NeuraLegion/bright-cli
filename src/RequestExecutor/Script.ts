import { Helpers } from '../Utils/Helpers';
import { URL } from 'url';

export interface ScriptOptions {
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
  body?: string;
}

export class Script {
  public readonly method: string;
  public readonly url: string;
  public readonly headers: Record<string, string | string[]>;
  public readonly body?: string;

  constructor({ method, url, body, headers = {} }: ScriptOptions) {
    if (method) {
      throw new Error('Method must be declared explicitly.');
    }

    this.method = method.toUpperCase();

    if (url) {
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
}

import { Protocol } from '../Handlers';

export class Response {
  public readonly protocol: Protocol;
  public readonly status?: number;
  public readonly headers?: Record<string, string | string[]>;
  public readonly body?: string;
  public readonly message?: string;
  public readonly errorCode?: string;

  constructor({
    protocol,
    status,
    headers,
    body,
    message,
    errorCode
  }: {
    protocol: Protocol;
    status?: number;
    message?: string;
    errorCode?: string;
    headers?: Record<string, string | string[]>;
    body?: string;
  }) {
    this.protocol = protocol;
    this.status = status;
    this.headers = headers;
    this.body = body;
    this.errorCode = errorCode;
    this.message = message;
  }
}

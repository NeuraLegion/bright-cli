/* eslint-disable @typescript-eslint/naming-convention */
import { Protocol } from '../Handlers';

export class Response {
  public readonly protocol: Protocol;
  public readonly status_code?: number;
  public readonly headers?: Record<string, string | string[]>;
  public readonly body?: string;
  public readonly message?: string;
  public readonly error_code?: string;

  constructor({
    protocol,
    statusCode,
    headers,
    body,
    message,
    errorCode
  }: {
    protocol: Protocol;
    statusCode?: number;
    message?: string;
    errorCode?: string;
    headers?: Record<string, string | string[]>;
    body?: string;
  }) {
    this.protocol = protocol;
    this.status_code = statusCode;
    this.headers = headers;
    this.body = body;
    this.error_code = errorCode;
    this.message = message;
  }
}

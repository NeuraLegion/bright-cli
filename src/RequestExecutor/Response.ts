export class Response {
  public readonly status?: number;
  public readonly headers?: Record<string, string | string[]>;
  public readonly body?: string;
  public readonly message?: string;
  public readonly errorCode?: string;

  constructor({
    status,
    headers,
    body,
    message,
    errorCode
  }: {
    status?: number;
    message?: string;
    errorCode?: string;
    headers?: Record<string, string | string[]>;
    body?: string;
  }) {
    this.status = status;
    this.headers = headers;
    this.body = body;
    this.errorCode = errorCode;
    this.message = message;
  }
}

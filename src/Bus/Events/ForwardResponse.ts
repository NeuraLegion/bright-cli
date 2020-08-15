import { Event } from '../Event';

export class ForwardResponse implements Event {
  public readonly status?: number;
  public readonly headers?: Record<string, string | string[]>;
  public readonly body?: string;
  public readonly message?: string;
  public readonly errorCode?: string;

  constructor(
    status: number,
    headers: Record<string, string | string[]>,
    body: string,
    message: string,
    errorCode: string
  ) {
    this.status = status;
    this.headers = headers;
    this.body = body;
    this.message = message;
    this.errorCode = errorCode;
  }
}

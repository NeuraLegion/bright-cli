import { Event } from '../Event';

export class ForwardResponse implements Event {
  public readonly status_code?: number;
  public readonly headers?: Record<string, string | string[]>;
  public readonly body?: string;

  constructor(
    status: number,
    headers: Record<string, string | string[]>,
    body: string
  ) {
    this.status_code = status;
    this.headers = headers;
    this.body = body;
  }
}

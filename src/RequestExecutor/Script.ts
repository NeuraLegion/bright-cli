export class Script {
  public readonly method: string;
  public readonly url: string;
  public readonly headers: Record<string, string | string[]>;
  public readonly body?: string;

  constructor({
    method,
    url,
    headers,
    body
  }: {
    method: string;
    url: string;
    headers: Record<string, string | string[]>;
    body?: string;
  }) {
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.body = body;
  }
}

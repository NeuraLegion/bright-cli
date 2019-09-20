import { Headers } from 'request';

export class InlineHeaders {
  public parse(headers: string[] = []): Headers {
    return this.prepareArgHeaders(headers);
  }

  private prepareArgHeaders(headers: string[]): Headers {
    return headers.reduce(
      (acc: Headers, value: string) => ({ ...acc, ...this.parseHeader(value) }),
      {}
    );
  }

  private parseHeader(header: string): Headers {
    if (!header) {
      return {};
    }

    const [key, value]: string[] = header
      .split(':', 2)
      .map((item: string) => decodeURIComponent(item.trim()));

    return { [key]: value } as Headers;
  }
}

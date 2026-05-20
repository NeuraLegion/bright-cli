// RFC 7230 §3.2.6 — characters allowed in a header field name (token)
const HEADER_TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export interface ParsedHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  rawBody: Buffer;
  ttfb: number;
}

export class RawHttpResponseParser {
  public parse(raw: Buffer, ttfb: number): ParsedHttpResponse {
    const headEnd = raw.indexOf('\r\n\r\n');
    const headerSection = raw
      .subarray(0, headEnd === -1 ? raw.length : headEnd)
      .toString('latin1');

    const lines = headerSection.split('\r\n');
    const statusCode = this.parseStatusLine(lines[0]);
    const headers = this.parseHeaders(lines.slice(1));
    const rawBody = this.parseBody(raw, headEnd, headers);

    return { statusCode, headers, rawBody, ttfb };
  }

  private parseStatusLine(line: string): number {
    // e.g. "HTTP/1.1 200 OK"
    const spaceIdx = line.indexOf(' ');

    if (spaceIdx === -1) {
      return 0;
    }

    return parseInt(line.substring(spaceIdx + 1), 10) || 0;
  }

  private parseHeaders(lines: string[]): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};

    for (const line of lines) {
      const parsed = this.parseHeaderLine(line);

      if (!parsed) {
        continue;
      }

      const { name, value } = parsed;

      if (headers[name] !== undefined) {
        headers[name] = Array.isArray(headers[name])
          ? [...(headers[name] as string[]), value]
          : [headers[name] as string, value];
      } else {
        headers[name] = value;
      }
    }

    return headers;
  }

  private parseHeaderLine(
    line: string
  ): { name: string; value: string } | null {
    const colonIdx = line.indexOf(':');
    const rawFieldName = colonIdx !== -1 ? line.substring(0, colonIdx) : '';

    if (colonIdx === -1 || !HEADER_TOKEN_RE.test(rawFieldName)) {
      return null;
    }

    return {
      name: rawFieldName.trim().toLowerCase(),
      value: line.substring(colonIdx + 1).trim()
    };
  }

  private parseBody(
    raw: Buffer,
    headEnd: number,
    headers: Record<string, string | string[]>
  ): Buffer {
    if (headEnd === -1) {
      return Buffer.alloc(0);
    }

    const body = raw.subarray(headEnd + 4);

    const contentLength = headers['content-length'];

    if (typeof contentLength === 'string') {
      const len = parseInt(contentLength, 10);

      if (!isNaN(len)) {
        return body.subarray(0, len);
      }
    }

    return body;
  }
}

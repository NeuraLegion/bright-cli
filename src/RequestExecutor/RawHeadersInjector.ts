import type { RawHeader, Request } from './Request';
import { Response } from './Response';
import { Protocol } from './Protocol';
import { injectable } from 'tsyringe';
import net from 'node:net';
import tls from 'node:tls';
import { parse as parseUrl } from 'node:url';

interface ResponseState {
  headersDone: boolean;
  contentLength: number;
  bodyReceived: number;
}

/**
 * Sends HTTP requests that carry raw (potentially malformed) header lines
 * verbatim over the wire.
 *
 * libcurl validates and normalises header field names — it silently drops any
 * entry in the `HTTPHEADER` list that does not contain a colon, which means
 * lines like `;response.writeHead(…)` are lost before reaching the target
 * server.  To preserve them we bypass libcurl entirely for these requests and
 * write the raw bytes directly to a TCP (or TLS) socket.
 *
 * The `index` carried by each {@link RawHeader} is the 0-based position of the
 * line in the **original** full header section (clean + raw lines combined).
 * We use that information to reconstruct the original header order when
 * assembling the outgoing request string.
 */
@injectable()
export class RawHeadersInjector {
  private readonly CONNECTION_TIMEOUT_MS = 10_000;
  private readonly HEADER_TERMINATOR = '\r\n\r\n';

  /**
   * Send `request` to its target host with `rawHeaders` spliced back into
   * the header block at their original positions.
   *
   * Returns a {@link Response} matching the structure returned by
   * {@link HttpRequestExecutor}.
   */
  public async send(request: Request): Promise<Response> {
    const rawRequest = this.buildRawRequest(request);
    const rawResponse = await this.sendRaw(request, rawRequest);

    return this.parseResponse(rawResponse, request);
  }

  /**
   * Splice `rawHeaders` into `curlHeaderLines` at their original positions and
   * return the resulting list.  The input array is not mutated.
   *
   * The `index` on each raw header is its 0-based position in the original
   * full header section (both clean and raw lines combined).  We walk through
   * the original position space and re-interleave the raw lines.
   *
   * @param curlHeaderLines  The clean header lines already built for libcurl.
   * @param rawHeaders       The malformed header lines to re-inject.
   * @returns A new array with the raw lines inserted at the correct positions.
   */
  public inject(
    curlHeaderLines: string[],
    rawHeaders: readonly RawHeader[]
  ): string[] {
    if (!rawHeaders.length) {
      return curlHeaderLines;
    }

    const sorted = [...rawHeaders].sort((a, b) => a.index - b.index);

    const result: string[] = [];
    let cleanIdx = 0;
    let rawIdx = 0;
    let pos = 0;

    while (rawIdx < sorted.length || cleanIdx < curlHeaderLines.length) {
      const nextRaw = sorted[rawIdx];
      const hasClean = cleanIdx < curlHeaderLines.length;

      if (nextRaw && nextRaw.index <= pos) {
        result.push(nextRaw.line);
        rawIdx++;
      } else if (hasClean) {
        result.push(curlHeaderLines[cleanIdx++]);
      } else {
        // Out-of-range raw lines are appended at the end.
        result.push(nextRaw.line);
        rawIdx++;
      }

      pos++;
    }

    return result;
  }

  private buildRawRequest(request: Request): Buffer {
    const { pathname, search, hash } = new URL(request.url);
    const path = `${pathname}${search ?? ''}${hash ?? ''}` || '/';

    const cleanHeaderLines = this.buildCleanHeaderLines(request);

    const allHeaderLines = request.rawHeaders?.length
      ? this.inject(cleanHeaderLines, request.rawHeaders)
      : cleanHeaderLines;

    const requestLine = `${request.method} ${path} HTTP/1.1`;
    const raw =
      requestLine +
      '\r\n' +
      allHeaderLines.join('\r\n') +
      this.HEADER_TERMINATOR +
      (request.body ?? '');

    return Buffer.from(raw, 'latin1');
  }

  private buildCleanHeaderLines(request: Request): string[] {
    if (!request.headers) {
      return [];
    }

    const lines: string[] = [];

    for (const [key, value] of Object.entries(request.headers)) {
      if (!key) continue;

      const values = Array.isArray(value) ? value : [value];
      lines.push(...values.map((v) => `${key}: ${v ?? ''}`));
    }

    return lines;
  }

  private sendRaw(request: Request, rawRequest: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const { hostname, port, protocol } = parseUrl(request.url);
      const portNumber = port
        ? parseInt(port, 10)
        : protocol === 'https:'
        ? 443
        : 80;

      const chunks: Buffer[] = [];
      const state: ResponseState = {
        headersDone: false,
        contentLength: -1,
        bodyReceived: 0
      };

      const socket = this.openSocket(
        request,
        hostname,
        portNumber,
        protocol ?? ''
      );

      socket.setTimeout(request.timeout ?? this.CONNECTION_TIMEOUT_MS);

      socket.on('connect', () => socket.write(rawRequest));
      socket.on('secureConnect', () => socket.write(rawRequest));

      socket.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        this.processChunk(Buffer.concat(chunks), chunk, state);

        if (
          state.contentLength === 0 ||
          state.bodyReceived >= state.contentLength
        ) {
          resolve(Buffer.concat(chunks));
          socket.destroy();
        }
      });

      socket.on('end', () => {
        if (chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        }
      });

      socket.on('timeout', () => socket.destroy(new Error('Socket timed out')));

      socket.on('error', reject);
    });
  }

  private openSocket(
    request: Request,
    hostname: string,
    port: number,
    protocol: string
  ): net.Socket | tls.TLSSocket {
    const connectOptions = { host: hostname, port };

    if (protocol === 'https:' || request.secureEndpoint) {
      return tls.connect({ ...connectOptions, rejectUnauthorized: false });
    }

    return net.connect(connectOptions);
  }

  private processChunk(all: Buffer, chunk: Buffer, state: ResponseState): void {
    if (state.headersDone) {
      state.bodyReceived += chunk.length;

      return;
    }

    const terminator = Buffer.from(this.HEADER_TERMINATOR);
    const idx = all.indexOf(terminator);

    if (idx === -1) {
      return;
    }

    state.headersDone = true;
    const headerBlock = all.slice(0, idx).toString('latin1');
    const clMatch = headerBlock.match(/content-length:\s*(\d+)/i);
    state.contentLength = clMatch ? parseInt(clMatch[1], 10) : 0;
    state.bodyReceived = all.length - idx - terminator.length;
  }

  private parseResponse(rawResponse: Buffer, request: Request): Response {
    try {
      return this.parseResponseOrThrow(rawResponse, request);
    } catch (err) {
      return new Response({
        protocol: Protocol.HTTP,
        message: (err as Error).message,
        errorCode: 'EPARSE'
      });
    }
  }

  private parseResponseOrThrow(
    rawResponse: Buffer,
    request: Request
  ): Response {
    const raw = rawResponse.toString('latin1');
    const headerEnd = raw.indexOf(this.HEADER_TERMINATOR);

    if (headerEnd === -1) {
      return new Response({
        protocol: Protocol.HTTP,
        message: 'Malformed response: no header terminator',
        errorCode: 'EPARSE'
      });
    }

    const headerBlock = raw.slice(0, headerEnd);
    const bodyRaw = raw.slice(headerEnd + this.HEADER_TERMINATOR.length);
    const lines = headerBlock.split('\r\n');
    const statusMatch = lines[0].match(/^HTTP\/\d\.\d\s+(\d+)/);
    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0;

    return new Response({
      protocol: Protocol.HTTP,
      statusCode,
      headers: this.parseResponseHeaders(lines.slice(1)),
      body: bodyRaw,
      encoding: request.encoding
    });
  }

  private parseResponseHeaders(
    lines: string[]
  ): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(':');

      if (colonIdx === -1) continue;

      const name = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();

      if (!name) continue;

      const existing = headers[name];
      headers[name] =
        existing === undefined
          ? value
          : Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
    }

    return headers;
  }
}

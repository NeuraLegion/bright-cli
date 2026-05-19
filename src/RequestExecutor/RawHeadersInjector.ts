import type { MalformedHeaderLine, Request } from './Request';
import { Response } from './Response';
import { Protocol } from './Protocol';
import { injectable } from 'tsyringe';
import { CurlCode, Easy } from '@brightsec/node-libcurl';

const HEADER_TERMINATOR = '\r\n\r\n';
const DEFAULT_TIMEOUT_MS = 10_000;
const RECV_BUFFER_SIZE = 65_536;

interface RecvState {
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
 * server.  To preserve them we use libcurl's `CONNECT_ONLY` option to let
 * libcurl establish the TCP/TLS connection (honouring all TLS options, proxy
 * settings, etc.), then send the raw request bytes via `Easy.send()` and read
 * the response via `Easy.recv()`.
 *
 * The `index` carried by each {@link MalformedHeaderLine} is the 0-based position of the
 * line in the **original** full header section (clean + raw lines combined).
 * We use that information to reconstruct the original header order when
 * assembling the outgoing request string.
 */
@injectable()
export class RawHeadersInjector {
  /**
   * Send `request` to its target host with `malformedHeaderLines` spliced back into
   * the header block at their original positions.
   *
   * Returns a {@link Response} matching the structure returned by
   * {@link HttpRequestExecutor}.
   */
  public async send(request: Request): Promise<Response> {
    const rawRequest = this.buildRawRequest(request);
    const rawResponse = await this.sendViaLibcurl(request, rawRequest);

    return this.parseResponse(rawResponse, request);
  }

  /**
   * Splice `malformedHeaderLines` into `curlHeaderLines` at their original positions and
   * return the resulting list.  The input array is not mutated.
   *
   * The `index` on each malformed header line is its 0-based position in the original
   * full header section (both clean and raw lines combined).  We walk through
   * the original position space and re-interleave the malformed lines.
   *
   * @param curlHeaderLines       The clean header lines already built for libcurl.
   * @param malformedHeaderLines  The malformed header lines to re-inject.
   * @returns A new array with the malformed lines inserted at the correct positions.
   */
  public inject(
    curlHeaderLines: string[],
    malformedHeaderLines: readonly MalformedHeaderLine[]
  ): string[] {
    if (!malformedHeaderLines.length) {
      return curlHeaderLines;
    }

    const sorted = [...malformedHeaderLines].sort((a, b) => a.index - b.index);

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

    const allHeaderLines = request.malformedHeaderLines?.length
      ? this.inject(cleanHeaderLines, request.malformedHeaderLines)
      : cleanHeaderLines;

    const requestLine = `${request.method} ${path} HTTP/1.1`;
    const raw =
      requestLine +
      '\r\n' +
      allHeaderLines.join('\r\n') +
      HEADER_TERMINATOR +
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

  /**
   * Use libcurl's `CONNECT_ONLY` mode to establish a TCP/TLS connection
   * (inheriting all TLS and proxy options from the request), then send
   * `rawRequest` verbatim and accumulate the response bytes.
   */
  private sendViaLibcurl(
    request: Request,
    rawRequest: Buffer
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const easy = new Easy();

      try {
        this.configureEasy(easy, request);
      } catch (err) {
        easy.close();

        return reject(err);
      }

      // Establish the connection only — no request is sent by libcurl itself.
      const connectCode = easy.perform();

      if (connectCode !== CurlCode.CURLE_OK) {
        easy.close();

        return reject(
          new Error(
            `libcurl CONNECT_ONLY failed (code ${connectCode}): ${CurlCode[connectCode]}`
          )
        );
      }

      // Send the raw request bytes verbatim over the established connection.
      const { code: sendCode } = easy.send(rawRequest);

      if (sendCode !== CurlCode.CURLE_OK) {
        easy.close();

        return reject(
          new Error(
            `libcurl send failed (code ${sendCode}): ${CurlCode[sendCode]}`
          )
        );
      }

      // Read the response.  We poll with a short delay because the server may
      // not have flushed its response yet by the time send() returns.
      const timeout = request.timeout ?? DEFAULT_TIMEOUT_MS;
      const deadline = Date.now() + timeout;
      const chunks: Buffer[] = [];
      const recvBuf = Buffer.alloc(RECV_BUFFER_SIZE);
      const recvState: RecvState = {
        headersDone: false,
        contentLength: -1,
        bodyReceived: 0
      };

      const poll = (): void => {
        const { code: recvCode, bytesReceived } = easy.recv(recvBuf);

        if (
          recvCode !== CurlCode.CURLE_OK &&
          recvCode !== CurlCode.CURLE_AGAIN
        ) {
          easy.close();

          return reject(
            new Error(
              `libcurl recv failed (code ${recvCode}): ${CurlCode[recvCode]}`
            )
          );
        }

        this.processRecvChunk(recvBuf, bytesReceived, chunks, recvState);

        if (this.isResponseComplete(recvState)) {
          easy.close();

          return resolve(Buffer.concat(chunks));
        }

        if (recvCode === CurlCode.CURLE_AGAIN || bytesReceived === 0) {
          if (bytesReceived === 0 && recvCode === CurlCode.CURLE_OK) {
            // Server closed connection — return whatever we have.
            easy.close();

            return resolve(Buffer.concat(chunks));
          }

          if (Date.now() > deadline) {
            easy.close();

            return reject(new Error('libcurl recv timed out'));
          }

          return void setTimeout(poll, 10);
        }

        // More data may be available — read immediately.
        poll();
      };

      // Delay the first recv to give the server time to flush its response.
      setTimeout(poll, 10);
    });
  }

  private processRecvChunk(
    recvBuf: Buffer,
    bytesReceived: number,
    chunks: Buffer[],
    state: RecvState
  ): void {
    if (bytesReceived <= 0) {
      return;
    }

    chunks.push(Buffer.from(recvBuf.slice(0, bytesReceived)));

    if (state.headersDone) {
      state.bodyReceived += bytesReceived;

      return;
    }

    const all = Buffer.concat(chunks);
    const terminator = Buffer.from(HEADER_TERMINATOR);
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

  private isResponseComplete(state: RecvState): boolean {
    return (
      state.headersDone &&
      (state.contentLength === 0 || state.bodyReceived >= state.contentLength)
    );
  }

  private configureEasy(easy: Easy, request: Request): void {
    const { protocol, host } = new URL(request.url);

    easy.setOpt('URL', `${protocol}//${host}`);
    easy.setOpt('CONNECT_ONLY', true);
    easy.setOpt('SSL_VERIFYPEER', false);
    easy.setOpt('SSL_VERIFYHOST', 0);

    if (request.ca) {
      easy.setOpt('CAINFO_BLOB', request.ca);
    }

    if (request.pfx) {
      easy.setOpt('SSLCERT_BLOB', request.pfx);
      easy.setOpt('SSLCERTTYPE', 'P12');

      if (request.passphrase) {
        easy.setOpt('KEYPASSWD', request.passphrase);
      }
    }

    const timeout = request.timeout;

    if (typeof timeout === 'number') {
      easy.setOpt('TIMEOUT_MS', timeout);
    }
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
    const headerEnd = raw.indexOf(HEADER_TERMINATOR);

    if (headerEnd === -1) {
      return new Response({
        protocol: Protocol.HTTP,
        message: 'Malformed response: no header terminator',
        errorCode: 'EPARSE'
      });
    }

    const headerBlock = raw.slice(0, headerEnd);
    const bodyRaw = raw.slice(headerEnd + HEADER_TERMINATOR.length);
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

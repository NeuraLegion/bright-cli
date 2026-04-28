import type { RawHeader } from './Request';
import { injectable } from 'tsyringe';
import type { ClientRequest } from 'node:http';

/**
 * Injects raw (potentially malformed) header lines into the outgoing HTTP
 * request at their original positions.
 *
 * Node.js validates header field names against RFC 7230 token rules and rejects
 * names that contain characters such as `;`.  To forward those lines as-is to
 * the wire we intercept the socket's first write — which always contains the
 * complete serialised header block — and splice the raw lines in before any
 * bytes leave the process.
 *
 * The `index` carried by each {@link RawHeader} is the 0-based position of the
 * line in the original header section (not counting the request-line).  After
 * Node.js serialises the "clean" headers their relative order is preserved, so
 * inserting at `index + 1` (to account for the request-line at [0]) places each
 * raw line back between the same neighbours it had in the original request.
 *
 * This mirrors the approach used by {@link MalformedUrlRequestSender} for
 * malformed URL paths.
 */
@injectable()
export class RawHeadersInjector {
  public inject(req: ClientRequest, rawHeaders: readonly RawHeader[]): void {
    if (!rawHeaders.length) {
      return;
    }

    const sorted = [...rawHeaders].sort((a, b) => a.index - b.index);

    req.once('socket', (socket) => {
      const originalWrite = socket.write.bind(socket);
      let patched = false;

      socket.write = (...args): boolean => {
        let chunk = args[0];

        if (!patched) {
          patched = true;
          socket.write = originalWrite;
          chunk = this.injectIntoHeaderBlock(chunk, sorted);
        }

        return originalWrite(chunk, ...(args.slice(1) as any[]));
      };
    });
  }

  private injectIntoHeaderBlock(
    chunk: string | Uint8Array,
    sortedRawHeaders: readonly RawHeader[]
  ): string | Buffer {
    const isBinary = chunk instanceof Uint8Array;
    // Use latin1 so every byte round-trips through a JS string unchanged.
    const str = isBinary
      ? Buffer.from(chunk).toString('latin1')
      : (chunk as string);

    const TERMINATOR = '\r\n\r\n';
    const terminatorIdx = str.indexOf(TERMINATOR);

    // If there is no header terminator in this chunk, leave it untouched.
    if (terminatorIdx === -1) {
      return chunk instanceof Uint8Array
        ? Buffer.from(chunk)
        : (chunk as string);
    }

    // Split at the header/body boundary.  `body` may be an empty string when
    // there is no body data in this write.
    const body = str.slice(terminatorIdx + TERMINATOR.length);

    // The header section ends with \r\n (before the \r\n\r\n terminator).
    // Split on \r\n gives a trailing empty string we remove so that
    // endBoundary points to the slot just after the last real header line.
    const lines = str.slice(0, terminatorIdx).split('\r\n');
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }
    // Fixed boundary: one past the last real header line (end-of-block slot).
    const endBoundary = lines.length;

    let insertionOffset = 0;
    for (const { index, line } of sortedRawHeaders) {
      const insertPos = Math.min(index + 1, endBoundary) + insertionOffset;
      lines.splice(insertPos, 0, line);
      insertionOffset++;
    }

    // Reconstruct: join lines with \r\n, then append the header terminator and
    // any body bytes that were coalesced into this write.
    const result = lines.join('\r\n') + TERMINATOR + body;

    return isBinary ? Buffer.from(result, 'latin1') : result;
  }
}

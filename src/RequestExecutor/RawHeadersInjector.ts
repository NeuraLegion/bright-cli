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

  /**
   * Splices raw header lines into the serialised header block at their
   * original 0-based positions.
   *
   * The wire format of the first socket write is:
   *   `METHOD path HTTP/x.x\r\n<header>: <value>\r\n...\r\n\r\n`
   *
   * After `split('\r\n')`:
   *   index 0  → request-line
   *   index 1+ → header lines
   *   last two → '' (from the trailing \r\n\r\n)
   *
   * Insertion formula (processed in ascending index order):
   *   insertPos = min(rawHeader.index + 1, endBoundary) + insertionOffset
   * where endBoundary = lines.length - 2 (fixed at entry, before any splices).
   */
  private injectIntoHeaderBlock(
    chunk: string | Uint8Array,
    sortedRawHeaders: readonly RawHeader[]
  ): string | Buffer {
    const isBinary = chunk instanceof Uint8Array;
    const str = isBinary
      ? Buffer.from(chunk).toString('latin1')
      : (chunk as string);

    const lines = str.split('\r\n');
    // Fixed boundary: last valid insertion slot (before the trailing \r\n\r\n)
    const endBoundary = lines.length - 2;

    let offset = 0;
    for (const { index, line } of sortedRawHeaders) {
      const insertPos = Math.min(index + 1, endBoundary) + offset;
      lines.splice(insertPos, 0, line);
      offset++;
    }

    const result = lines.join('\r\n');

    return isBinary ? Buffer.from(result, 'latin1') : result;
  }
}

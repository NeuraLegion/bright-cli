import { injectable } from 'tsyringe';
import http, { ClientRequest } from 'node:http';
import https, { RequestOptions as ClientRequestOptions } from 'node:https';

/**
 * Sends HTTP(S) requests whose path contains characters that Node.js normally
 * rejects with `ERR_UNESCAPED_CHARACTERS`.
 *
 * Strategy: construct the `ClientRequest` with a known-safe placeholder path so
 * that Node.js validation passes, then intercept the socket's first write and
 * replace the placeholder with the actual raw path byte-for-byte before any
 * bytes reach the wire.
 *
 * `latin1` is used for string↔Buffer conversion because it is a 1:1 mapping of
 * bytes 0–255, preserving arbitrary byte sequences without loss.
 */
@injectable()
export class MalformedUrlRequestSender {
  private readonly PATH_PLACEHOLDER = '/SAFE_PATH_PLACEHOLDER';

  public send(
    opts: ClientRequestOptions,
    secureEndpoint: boolean
  ): ClientRequest {
    const rawPath = opts.path;
    if (!rawPath) {
      throw new Error('Request options must include a path.');
    }
    const safeOpts: ClientRequestOptions = {
      ...opts,
      path: this.PATH_PLACEHOLDER
    };

    const protocol = secureEndpoint ? https : http;
    const req = protocol.request(safeOpts);

    req.once('socket', (socket) => {
      const originalWrite = socket.write.bind(socket);
      let patched = false;

      socket.write = (
        chunk: string | Uint8Array,
        encodingOrCb?: any,
        cb?: any
      ): boolean => {
        if (!patched) {
          patched = true;
          chunk = this.patchRequestLine(chunk, rawPath);
        }

        // Restore original immediately so this wrapper is used only once
        socket.write = originalWrite;

        return originalWrite(chunk, encodingOrCb, cb);
      };
    });

    return req;
  }

  /**
   * Replaces the placeholder path in the first write of the socket (i.e. the
   * HTTP request-line) with the actual raw path.
   */
  private patchRequestLine(
    chunk: string | Uint8Array,
    rawPath: string
  ): string | Buffer {
    const str =
      typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('latin1');

    const escapedPlaceholder = this.PATH_PLACEHOLDER.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    const patched = str.replace(
      new RegExp(`^([^ ]+ )${escapedPlaceholder} (HTTP\\/)`),
      (_, method: string, httpVer: string) => `${method}${rawPath} ${httpVer}`
    );

    if (patched === str) {
      throw new Error(
        'Failed to patch HTTP request line: placeholder path was not found in the first socket write.'
      );
    }

    return typeof chunk === 'string' ? patched : Buffer.from(patched, 'latin1');
  }
}

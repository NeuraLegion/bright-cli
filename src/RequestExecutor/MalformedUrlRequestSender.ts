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
  private static readonly PATH_PLACEHOLDER = '/SAFE_PATH_PLACEHOLDER';

  /**
   * Replaces the placeholder path in the first write of the socket (i.e. the
   * HTTP request-line) with the actual raw path.
   */
  private static patchRequestLine(
    chunk: string | Uint8Array,
    rawPath: string
  ): string | Buffer {
    const str =
      typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('latin1');

    const escapedPlaceholder =
      MalformedUrlRequestSender.PATH_PLACEHOLDER.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

    const patched = str.replace(
      new RegExp(`^([A-Z]+ )${escapedPlaceholder} (HTTP\\/)`),
      (_, method: string, httpVer: string) => `${method}${rawPath} ${httpVer}`
    );

    return typeof chunk === 'string' ? patched : Buffer.from(patched, 'latin1');
  }

  /**
   * @param opts          Request options produced by the caller. `opts.path`
   *                      must contain the raw (possibly malformed) path that
   *                      should be written to the wire.
   * @param secureEndpoint Whether to use `https` instead of `http`.
   */
  public send(
    opts: ClientRequestOptions,
    secureEndpoint: boolean
  ): ClientRequest {
    const rawPath = opts.path as string;
    const safeOpts: ClientRequestOptions = {
      ...opts,
      path: MalformedUrlRequestSender.PATH_PLACEHOLDER
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
          chunk = MalformedUrlRequestSender.patchRequestLine(chunk, rawPath);
        }

        // Restore original immediately so this wrapper is used only once
        socket.write = originalWrite;

        return originalWrite(chunk, encodingOrCb, cb);
      };
    });

    return req;
  }
}

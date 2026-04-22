import 'reflect-metadata';
import { MalformedUrlRequestSender } from './MalformedUrlRequestSender';
import net, { AddressInfo } from 'node:net';

interface ServerFixture {
  port: number;
  received: () => Promise<string>;
  close: () => void;
}

/**
 * Starts a bare TCP server that accumulates raw bytes until a full HTTP
 * request (request-line + headers + optional body) is received, then
 * responds with a minimal 200 OK so the client can close cleanly.
 */
function startTcpServer(): Promise<ServerFixture> {
  return new Promise((resolve, reject) => {
    let resolveReceived!: (raw: string) => void;
    const receivedPromise = new Promise<string>((res) => {
      resolveReceived = res;
    });

    const server = net.createServer((socket) => {
      const chunks: Buffer[] = [];

      socket.on('data', (chunk) => {
        chunks.push(chunk);
        const all = Buffer.concat(chunks).toString('latin1');
        const headerEnd = all.indexOf('\r\n\r\n');

        if (headerEnd === -1) {
          return;
        }

        const headerSection = all.substring(0, headerEnd);
        const clMatch = headerSection.match(/content-length:\s*(\d+)/i);
        const expectedBodyLen = clMatch ? parseInt(clMatch[1], 10) : 0;
        const bodyReceived = all.length - (headerEnd + 4);

        if (bodyReceived >= expectedBodyLen) {
          socket.write(
            'HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'
          );
          resolveReceived(all);
          socket.end();
        }
      });

      socket.on('error', () => {
        // ignore socket-level errors in the test server
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        received: () => receivedPromise,
        close: () => server.close()
      });
    });

    server.on('error', reject);
  });
}

function extractRequestLine(raw: string): string {
  return raw.substring(0, raw.indexOf('\r\n'));
}

describe('MalformedUrlRequestSender', () => {
  let sender: MalformedUrlRequestSender;

  beforeEach(() => {
    sender = new MalformedUrlRequestSender();
  });

  describe('send() with secureEndpoint=false', () => {
    it('writes a malformed path verbatim on the wire', async () => {
      // arrange
      const fixture = await startTcpServer();
      const rawPath = '/?msg=Server: ESA1 HTTP/1.1';

      // act
      const req = sender.send(
        {
          hostname: '127.0.0.1',
          port: fixture.port,
          path: rawPath,
          method: 'GET'
        },
        false
      );
      req.end();

      const raw = await fixture.received();
      fixture.close();

      // assert
      expect(extractRequestLine(raw)).toBe(`GET ${rawPath} HTTP/1.1`);
    });

    it('writes a normal path correctly', async () => {
      // arrange
      const fixture = await startTcpServer();
      const normalPath = '/api/v1/resource?key=value';

      // act
      const req = sender.send(
        {
          hostname: '127.0.0.1',
          port: fixture.port,
          path: normalPath,
          method: 'GET'
        },
        false
      );
      req.end();

      const raw = await fixture.received();
      fixture.close();

      // assert
      expect(extractRequestLine(raw)).toBe(`GET ${normalPath} HTTP/1.1`);
    });

    it('never sends the safe placeholder path to the wire', async () => {
      // arrange
      const fixture = await startTcpServer();
      const rawPath = '/?x=1&y=2';

      // act
      const req = sender.send(
        {
          hostname: '127.0.0.1',
          port: fixture.port,
          path: rawPath,
          method: 'GET'
        },
        false
      );
      req.end();

      const raw = await fixture.received();
      fixture.close();

      // assert
      expect(raw).not.toContain('/SAFE_PATH_PLACEHOLDER');
    });

    it('patches only the request-line write — body chunks arrive unmodified', async () => {
      // arrange
      const fixture = await startTcpServer();
      const rawPath = '/submit';
      // Body deliberately starts with a pattern that matches the request-line
      // regex so we can verify it is NOT modified by a second patch call.
      const bodyContent = 'GET /SAFE_PATH_PLACEHOLDER HTTP/1.1\r\n';

      // act
      const req = sender.send(
        {
          hostname: '127.0.0.1',
          port: fixture.port,
          path: rawPath,
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': String(Buffer.byteLength(bodyContent))
          }
        },
        false
      );
      req.write(bodyContent);
      req.end();

      const raw = await fixture.received();
      fixture.close();

      // assert
      expect(extractRequestLine(raw)).toBe(`POST ${rawPath} HTTP/1.1`);
      expect(raw).toContain(bodyContent); // body arrives verbatim, not patched
    });
  });
});

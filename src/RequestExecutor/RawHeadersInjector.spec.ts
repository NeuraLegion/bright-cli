import 'reflect-metadata';
import { RawHeadersInjector } from './RawHeadersInjector';
import http from 'node:http';
import net, { AddressInfo } from 'node:net';

interface ServerFixture {
  port: number;
  received: () => Promise<string>;
  close: () => void;
}

/**
 * Bare TCP server that accumulates raw bytes until a full HTTP request is
 * received, then responds with a minimal 200 OK so the client can close cleanly.
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

        socket.write(
          'HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'
        );
        resolveReceived(all);
        socket.end();
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

/** Split a raw HTTP request into its header lines (excluding request-line). */
function headerLines(raw: string): string[] {
  const headerEnd = raw.indexOf('\r\n\r\n');
  const block = headerEnd === -1 ? raw : raw.substring(0, headerEnd);
  const [, ...lines]: string[] = block.split('\r\n');

  return lines;
}

describe('RawHeadersInjector', () => {
  let injector: RawHeadersInjector;

  beforeEach(() => {
    injector = new RawHeadersInjector();
  });

  describe('inject', () => {
    it('should not alter the request when rawHeaders is empty', async () => {
      // arrange
      const fixture = await startTcpServer();
      const req = http.request({
        hostname: '127.0.0.1',
        port: fixture.port,
        path: '/test',
        method: 'GET',
        headers: { 'x-only': 'header' }
      });

      // act
      injector.inject(req, []);
      req.end();

      const raw = await fixture.received();
      fixture.close();

      // assert
      const lines = headerLines(raw);
      expect(lines.some((l) => l.startsWith(';'))).toBe(false);
      expect(lines.some((l) => l.toLowerCase().startsWith('x-only'))).toBe(
        true
      );
    });

    it('should inject a single raw header line at the correct position', async () => {
      // arrange
      const fixture = await startTcpServer();
      const req = http.request({
        hostname: '127.0.0.1',
        port: fixture.port,
        path: '/test',
        method: 'GET',
        // Node.js will serialise these in the order given
        headers: {
          'accept': 'application/json', // position 0 in header section
          'x-after-raw': 'after' // position 1 in header section
        }
      });

      // The raw line should appear at original index 1 (between accept and x-after-raw)
      const rawLine =
        ';response.writeHead(200, {"injected": "yes"});response.write("injected");';
      injector.inject(req, [{ index: 1, line: rawLine }]);
      req.end();

      const raw = await fixture.received();
      fixture.close();

      // assert: raw line is present and appears between 'accept' and 'x-after-raw'
      const lines = headerLines(raw);
      const acceptIdx = lines.findIndex((l) =>
        l.toLowerCase().startsWith('accept')
      );
      const rawLineIdx = lines.findIndex((l) => l === rawLine);
      const afterIdx = lines.findIndex((l) =>
        l.toLowerCase().startsWith('x-after-raw')
      );

      expect(rawLineIdx).toBeGreaterThan(-1);
      expect(rawLineIdx).toBeGreaterThan(acceptIdx);
      expect(rawLineIdx).toBeLessThan(afterIdx);
    });

    it('should inject multiple raw header lines preserving their relative order', async () => {
      // arrange
      const fixture = await startTcpServer();
      const req = http.request({
        hostname: '127.0.0.1',
        port: fixture.port,
        path: '/test',
        method: 'GET',
        headers: {
          'accept': 'text/plain', // position 0
          'x-mid': 'mid', // position 1
          'x-last': 'last' // position 2
        }
      });

      const line0 = ';malformed-at-0';
      const line2 = '@malformed-at-2';

      // provide in reverse order to verify sort-by-index logic
      injector.inject(req, [
        { index: 2, line: line2 },
        { index: 0, line: line0 }
      ]);
      req.end();

      const raw = await fixture.received();
      fixture.close();

      // assert
      const lines = headerLines(raw);
      const idx0 = lines.findIndex((l) => l === line0);
      const idxMid = lines.findIndex((l) =>
        l.toLowerCase().startsWith('x-mid')
      );
      const idx2 = lines.findIndex((l) => l === line2);

      expect(idx0).toBeGreaterThan(-1);
      expect(idx2).toBeGreaterThan(-1);
      // line0 must come before x-mid, and line2 must come after x-mid
      expect(idx0).toBeLessThan(idxMid);
      expect(idx2).toBeGreaterThan(idxMid);
    });

    it('should clamp a raw header index beyond the last header to the end of the header block', async () => {
      // arrange
      const fixture = await startTcpServer();
      const req = http.request({
        hostname: '127.0.0.1',
        port: fixture.port,
        path: '/test',
        method: 'GET',
        headers: { 'x-only': 'header' }
      });

      const rawLine = ';late-injected';
      // index 99 is far beyond the actual header count — should land at the end
      injector.inject(req, [{ index: 99, line: rawLine }]);
      req.end();

      const raw = await fixture.received();
      fixture.close();

      // assert: raw line is present and is the last non-empty header line
      const lines = headerLines(raw).filter((l) => l.length > 0);
      expect(lines.at(-1)).toBe(rawLine);
    });
  });
});

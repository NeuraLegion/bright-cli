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

/** Return the body portion of a raw HTTP request (bytes after \r\n\r\n). */
function bodyBytes(raw: string): string {
  const terminator = '\r\n\r\n';
  const idx = raw.indexOf(terminator);

  return idx === -1 ? '' : raw.slice(idx + terminator.length);
}

/**
 * Bare TCP server that accumulates raw bytes until a full HTTP request is
 * received (headers + body according to Content-Length), then responds with a
 * minimal 200 OK so the client can close cleanly.
 */
function startTcpServerFull(): Promise<ServerFixture> {
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
        const terminator = '\r\n\r\n';
        const headerEnd = all.indexOf(terminator);

        if (headerEnd === -1) {
          return;
        }

        const headerSection = all.slice(0, headerEnd);
        const bodyStart = headerEnd + terminator.length;
        const clMatch = headerSection.match(/content-length:\s*(\d+)/i);
        const expectedBodyLen = clMatch ? parseInt(clMatch[1], 10) : 0;
        const actualBodyLen = all.length - bodyStart;

        if (actualBodyLen < expectedBodyLen) {
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

    it('should inject multiple raw header lines at non-adjacent positions', async () => {
      // arrange
      const fixture = await startTcpServer();
      const req = http.request({
        hostname: '127.0.0.1',
        port: fixture.port,
        path: '/test',
        method: 'GET',
        headers: {
          'accept': 'text/plain', // position 0
          'x-pos-1': 'pre-last', // position 1
          'x-post-2': 'last' // position 2
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

      // assert positional ordering: line0 before accept, line2 before x-pos-1
      const lines = headerLines(raw);
      const idxLine0 = lines.indexOf(line0);
      const idxAccept = lines.findIndex((l) =>
        l.toLowerCase().startsWith('accept')
      );
      const idxLine2 = lines.indexOf(line2);
      const idxXPos1 = lines.findIndex((l) =>
        l.toLowerCase().startsWith('x-pos-1')
      );

      expect(idxLine0).toBeGreaterThan(-1);
      expect(idxLine2).toBeGreaterThan(-1);
      expect(idxLine0).toBeLessThan(idxAccept);
      expect(idxLine2).toBeLessThan(idxXPos1);
    });

    it('should inject consecutive raw header lines both before the same clean header', async () => {
      // Regression: insertionOffset must NOT be applied.
      // Given sortedRawHeaders = [{index:1, line:A}, {index:2, line:B}] and
      // clean headers [Host, Accept], the expected wire order is:
      //   Host  A  B  Accept
      // (A and B share the same "slot" between Host and Accept in the original.)
      const fixture = await startTcpServer();
      const req = http.request({
        hostname: '127.0.0.1',
        port: fixture.port,
        path: '/test',
        method: 'GET',
        headers: {
          host: 'google.com', // position 0 — but Node sets this automatically
          accept: 'text/html' // position 1
        }
      });

      const lineA = ';sample-malformed-header-1';
      const lineB = ';sample-malformed-header-2';

      // both raw lines were originally between the two clean headers
      injector.inject(req, [
        { index: 1, line: lineA },
        { index: 2, line: lineB }
      ]);
      req.end();

      const raw = await fixture.received();
      fixture.close();

      const lines = headerLines(raw);
      const idxA = lines.indexOf(lineA);
      const idxB = lines.indexOf(lineB);
      const idxAccept = lines.findIndex((l) =>
        l.toLowerCase().startsWith('accept')
      );

      expect(idxA).toBeGreaterThan(-1);
      expect(idxB).toBeGreaterThan(-1);
      // A comes before B
      expect(idxA).toBeLessThan(idxB);
      // both A and B come before Accept
      expect(idxA).toBeLessThan(idxAccept);
      expect(idxB).toBeLessThan(idxAccept);
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

    it('should not corrupt body bytes when headers and body arrive in the same write', async () => {
      // arrange — use the full-request server so it waits for the body too
      const fixture = await startTcpServerFull();
      const body = 'hello=world&foo=bar';
      const req = http.request({
        hostname: '127.0.0.1',
        port: fixture.port,
        path: '/submit',
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(body).toString(),
          'x-after': 'yes'
        }
      });

      const rawLine = ';injected-header';
      injector.inject(req, [{ index: 1, line: rawLine }]);
      // req.end(body) causes Node to coalesce headers + body into one write
      req.end(body);

      const raw = await fixture.received();
      fixture.close();

      // assert: injected header is present
      const lines = headerLines(raw);
      expect(lines.some((l) => l === rawLine)).toBe(true);

      // assert: body is byte-for-byte intact
      expect(bodyBytes(raw)).toBe(body);
    });
  });
});

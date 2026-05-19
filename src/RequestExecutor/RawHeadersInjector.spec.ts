import 'reflect-metadata';
import { RawHeadersInjector } from './RawHeadersInjector';
import { Request } from './Request';
import { Protocol } from './Protocol';
import net, { AddressInfo } from 'node:net';

interface TcpFixture {
  port: number;
  received: () => Promise<string>;
  close: () => void;
}

/**
 * Bare TCP server that accumulates raw bytes until a full HTTP request is
 * received, then responds with a minimal 200 OK so the client can close cleanly.
 */
function startTcpServer(): Promise<TcpFixture> {
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
    it('should return the same array reference when malformedHeaderLines is empty', () => {
      // arrange
      const curlHeaders = ['Accept: application/json', 'Host: example.com'];

      // act
      const result = injector.inject(curlHeaders, []);

      // assert
      expect(result).toBe(curlHeaders);
    });

    it('should not mutate the original curlHeaderLines array', () => {
      // arrange
      const curlHeaders = ['Accept: application/json', 'Host: example.com'];
      const original = [...curlHeaders];

      // act
      injector.inject(curlHeaders, [{ index: 0, line: ';injected' }]);

      // assert
      expect(curlHeaders).toEqual(original);
    });

    it('should inject a single raw line at the correct position', () => {
      // arrange
      // Original section: [Accept(0), rawLine(1), User-Agent(2), Host(3)]
      // After stripping raw: clean = [Accept, User-Agent, Host]
      const curlHeaders = [
        'Accept: application/json',
        'User-Agent: Mozilla/5.0',
        'Host: example.com'
      ];
      const rawLine =
        ';response.writeHead(200, {"token": "token"});response.write("token");';

      // act
      const result = injector.inject(curlHeaders, [
        { index: 1, line: rawLine }
      ]);

      // assert
      const acceptIdx = result.indexOf('Accept: application/json');
      const rawIdx = result.indexOf(rawLine);
      const userAgentIdx = result.indexOf('User-Agent: Mozilla/5.0');

      expect(rawIdx).toBeGreaterThan(acceptIdx);
      expect(rawIdx).toBeLessThan(userAgentIdx);
    });

    it('should inject multiple raw lines at non-adjacent positions', () => {
      // arrange
      // Original: [line0(0), Accept(1), UserAgent(2), line2(3), Host(4)]
      // Clean: [Accept, UserAgent, Host]
      const curlHeaders = [
        'Accept: text/plain',
        'User-Agent: curl/7',
        'Host: example.com'
      ];
      const line0 = ';first-malformed';
      const line2 = '@second-malformed';

      // act — provide in reverse order to test sort-by-index logic
      const result = injector.inject(curlHeaders, [
        { index: 3, line: line2 },
        { index: 0, line: line0 }
      ]);

      // assert
      const idx0 = result.indexOf(line0);
      const idxAccept = result.indexOf('Accept: text/plain');
      const idx2 = result.indexOf(line2);
      const idxUserAgent = result.indexOf('User-Agent: curl/7');

      expect(idx0).toBeGreaterThan(-1);
      expect(idx2).toBeGreaterThan(-1);
      // line0 appears before Accept
      expect(idx0).toBeLessThan(idxAccept);
      // line2 appears before Host (index 3 is before Host at index 4)
      expect(idx2).toBeLessThan(result.indexOf('Host: example.com'));
      // line2 appears after User-Agent
      expect(idx2).toBeGreaterThan(idxUserAgent);
    });

    it('should inject consecutive raw lines both before the same clean header', () => {
      // Original: [Host(0), lineA(1), lineB(2), Accept(3)]
      // Clean: [Host, Accept]
      const curlHeaders = ['Host: example.com', 'Accept: text/html'];
      const lineA = ';sample-malformed-header-1';
      const lineB = ';sample-malformed-header-2';

      const result = injector.inject(curlHeaders, [
        { index: 1, line: lineA },
        { index: 2, line: lineB }
      ]);

      const idxA = result.indexOf(lineA);
      const idxB = result.indexOf(lineB);
      const idxAccept = result.indexOf('Accept: text/html');

      expect(idxA).toBeGreaterThan(-1);
      expect(idxB).toBeGreaterThan(-1);
      // A comes before B
      expect(idxA).toBeLessThan(idxB);
      // Both appear before Accept
      expect(idxA).toBeLessThan(idxAccept);
      expect(idxB).toBeLessThan(idxAccept);
    });

    it('should clamp a raw header index beyond the last clean header to the end', () => {
      // arrange
      const curlHeaders = ['Accept: application/json', 'Host: example.com'];
      const rawLine = ';late-injected';

      // act
      const result = injector.inject(curlHeaders, [
        { index: 99, line: rawLine }
      ]);

      // assert: raw line is present and is the last element
      expect(result.at(-1)).toBe(rawLine);
    });

    it('should inject a raw line at index 0 before all clean headers', () => {
      // arrange
      const curlHeaders = ['Accept: application/json', 'Host: example.com'];
      const rawLine = ';at-the-beginning';

      // act
      const result = injector.inject(curlHeaders, [
        { index: 0, line: rawLine }
      ]);

      // assert: first element is the raw line
      expect(result[0]).toBe(rawLine);
    });

    it('should preserve all original clean headers in the result', () => {
      // arrange
      const curlHeaders = [
        'Accept: application/json',
        'User-Agent: test',
        'Host: example.com'
      ];
      const rawLine = ';injected';

      // act
      const result = injector.inject(curlHeaders, [
        { index: 1, line: rawLine }
      ]);

      // assert: all original headers still present
      for (const h of curlHeaders) {
        expect(result).toContain(h);
      }
      // plus the injected line
      expect(result).toContain(rawLine);
      expect(result).toHaveLength(curlHeaders.length + 1);
    });

    it('should handle an empty curlHeaderLines array with a raw header', () => {
      // arrange
      const rawLine = ';only-raw';

      // act
      const result = injector.inject([], [{ index: 0, line: rawLine }]);

      // assert: raw line is added
      expect(result).toEqual([rawLine]);
    });

    it('should handle multiple raw headers all at index 0', () => {
      // arrange
      const curlHeaders = ['Accept: */*'];
      const lineA = ';first';
      const lineB = ';second';

      // act
      const result = injector.inject(curlHeaders, [
        { index: 0, line: lineA },
        { index: 0, line: lineB }
      ]);

      // assert: both raw lines appear before Accept
      const idxA = result.indexOf(lineA);
      const idxB = result.indexOf(lineB);
      const idxAccept = result.indexOf('Accept: */*');

      expect(idxA).toBeLessThan(idxAccept);
      expect(idxB).toBeLessThan(idxAccept);
    });
  });

  describe('send', () => {
    it('should send a raw header line verbatim on the wire', async () => {
      // arrange
      const fixture = await startTcpServer();
      const rawLine =
        ';response.writeHead(200, {"token": "token"});response.write("token");';
      const request = new Request({
        protocol: Protocol.HTTP,
        url: `http://127.0.0.1:${fixture.port}/path`,
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-after-raw': 'after'
        },
        malformedHeaderLines: [{ index: 1, line: rawLine }]
      });

      // act
      await injector.send(request);

      const raw = await fixture.received();
      fixture.close();

      // assert: raw line is in the wire bytes
      expect(raw).toContain(rawLine);
    });

    it('should place the raw line between its surrounding clean headers', async () => {
      // arrange
      // Original order: accept(0), rawLine(1), x-after(2)
      const fixture = await startTcpServer();
      const rawLine = ';injected-between';
      const request = new Request({
        protocol: Protocol.HTTP,
        url: `http://127.0.0.1:${fixture.port}/path`,
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-after': 'yes'
        },
        malformedHeaderLines: [{ index: 1, line: rawLine }]
      });

      // act
      await injector.send(request);

      const raw = await fixture.received();
      fixture.close();

      // assert: positional order on the wire
      const lines = headerLines(raw);
      const acceptIdx = lines.findIndex((l) =>
        l.toLowerCase().startsWith('accept')
      );
      const rawIdx = lines.indexOf(rawLine);
      const afterIdx = lines.findIndex((l) =>
        l.toLowerCase().startsWith('x-after')
      );

      expect(rawIdx).toBeGreaterThan(acceptIdx);
      expect(rawIdx).toBeLessThan(afterIdx);
    });

    it('should send multiple raw header lines in the correct order', async () => {
      // arrange
      // Original: accept(0), lineA(1), lineB(2), x-after(3)
      const fixture = await startTcpServer();
      const lineA = ';first-injected';
      const lineB = ';second-injected';
      const request = new Request({
        protocol: Protocol.HTTP,
        url: `http://127.0.0.1:${fixture.port}/path`,
        method: 'GET',
        headers: {
          'accept': 'text/plain',
          'x-after': 'value'
        },
        malformedHeaderLines: [
          { index: 1, line: lineA },
          { index: 2, line: lineB }
        ]
      });

      // act
      await injector.send(request);

      const raw = await fixture.received();
      fixture.close();

      // assert
      const lines = headerLines(raw);
      const idxA = lines.indexOf(lineA);
      const idxB = lines.indexOf(lineB);
      const idxAfter = lines.findIndex((l) =>
        l.toLowerCase().startsWith('x-after')
      );

      expect(idxA).toBeGreaterThan(-1);
      expect(idxB).toBeGreaterThan(-1);
      expect(idxA).toBeLessThan(idxB);
      expect(idxA).toBeLessThan(idxAfter);
      expect(idxB).toBeLessThan(idxAfter);
    });

    it('should return a Response with the correct status code', async () => {
      // arrange
      const fixture = await startTcpServer();
      const request = new Request({
        protocol: Protocol.HTTP,
        url: `http://127.0.0.1:${fixture.port}/`,
        method: 'GET',
        malformedHeaderLines: [{ index: 0, line: ';injected' }]
      });

      // act
      const response = await injector.send(request);
      fixture.close();

      // assert
      expect(response.statusCode).toBe(200);
    });
  });
});

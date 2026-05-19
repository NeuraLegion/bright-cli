import 'reflect-metadata';
import { HttpRequestExecutor } from './HttpRequestExecutor';
import { VirtualScript, VirtualScripts, VirtualScriptType } from '../Scripts';
import { Protocol } from './Protocol';
import { Request, RequestOptions, Cert } from './Request';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
import { RawHeadersInjector } from './RawHeadersInjector';
import {
  anyString,
  anything,
  instance,
  mock,
  reset,
  spy,
  verify,
  when
} from 'ts-mockito';
import http from 'node:http';
import { once } from 'node:events';
import net, { AddressInfo } from 'node:net';
import { promisify } from 'node:util';
import {
  brotliCompress,
  constants,
  gzip,
  deflate,
  deflateRaw
} from 'node:zlib';

const serversToClose: http.Server[] = [];

async function startServer(
  handler?: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{
  port: number;
  baseUrl: string;
  server: net.Server;
  received: () => Promise<string>;
  close: () => void;
}> {
  if (handler) {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    serversToClose.push(server);

    return {
      port,
      baseUrl: `http://127.0.0.1:${port}`,
      server,
      received: () =>
        Promise.reject(new Error('received() is not available in HTTP mode')),
      close: () => server.close()
    };
  }

  return new Promise((resolve) => {
    let resolveReceived: (data: string) => void;
    const receivedPromise = new Promise<string>((res) => {
      resolveReceived = res;
    });

    const server = net.createServer((socket) => {
      let raw = '';
      socket.on('data', (chunk) => {
        raw += chunk.toString('latin1');
        // Resolve immediately so the test can inspect the data, then send a
        // minimal HTTP/1.1 response so libcurl does not hang waiting for one.
        resolveReceived(raw);
        socket.write(
          'HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'
        );
        socket.end();
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        baseUrl: `http://127.0.0.1:${port}`,
        server,
        received: () => receivedPromise,
        close: () => server.close()
      });
    });
  });
}

/** Returns the first line (request-line) of a raw HTTP request string. */
function extractRequestLine(raw: string): string {
  return raw.split('\r\n')[0];
}

const createRequest = (options?: Partial<RequestOptions>) => {
  const requestOptions: RequestOptions = {
    url: 'http://127.0.0.1:1',
    headers: {},
    protocol: Protocol.HTTP,
    ...options
  };
  const request = new Request(requestOptions);
  const spiedRequest = spy(request);
  when(spiedRequest.method).thenReturn(options?.method ?? 'GET');

  return { requestOptions, request, spiedRequest };
};

describe('HttpRequestExecutor', () => {
  const virtualScriptsMock = mock<VirtualScripts>();
  const certificatesCacheMock = mock<CertificatesCache>();
  const certificatesResolverMock = mock<CertificatesResolver>();

  let MultiSpy!: jest.SpyInstance;

  const buildSut = (options: RequestExecutorOptions = {}) =>
    new HttpRequestExecutor(
      instance(virtualScriptsMock),
      options,
      certificatesCacheMock,
      instance(certificatesResolverMock),
      new RawHeadersInjector()
    );

  beforeEach(() => {
    // Spy on the Multi constructor so tests can assert on call count.
    // Capture the real constructor before installing the spy so that the
    // mock implementation can call through without recursion.
    type CurlLibModule = typeof import('@brightsec/node-libcurl');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const curlModule = require('@brightsec/node-libcurl') as CurlLibModule;
    const RealMulti = curlModule.Multi;
    MultiSpy = jest
      .spyOn(curlModule, 'Multi')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(
        () => new (RealMulti as any)()
      ) as unknown as jest.SpyInstance;
  });

  afterEach(() => {
    MultiSpy?.mockRestore();

    reset<
      | VirtualScripts
      | RequestExecutorOptions
      | CertificatesCache
      | CertificatesResolver
    >(virtualScriptsMock, certificatesCacheMock, certificatesResolverMock);

    return Promise.all(
      serversToClose.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.closeAllConnections();
            server.close(resolve);
          })
      )
    );
  });

  describe('protocol', () => {
    it('should return HTTP', () => {
      // arrange
      const sut = buildSut();

      // act
      const protocol = sut.protocol;

      // assert
      expect(protocol).toBe(Protocol.HTTP);
    });
  });

  describe('execute', () => {
    it('should call setHeaders on the provided request if additional headers were configured globally', async () => {
      // arrange
      const headers = { testHeader: 'test-header-value' };
      const sut = buildSut({ headers });
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });
      const { request, spiedRequest } = createRequest({ url: `${baseUrl}/` });

      // act
      await sut.execute(request);

      // assert
      verify(spiedRequest.setHeaders(headers)).once();
    });

    it('should not call setHeaders on the provided request if there were no additional headers configured', async () => {
      // arrange
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });
      const { request, spiedRequest } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut();

      // act
      await sut.execute(request);

      // assert
      verify(spiedRequest.setHeaders(anything())).never();
    });

    it('should transform the request if there is a suitable vm', async () => {
      // arrange
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });
      const { request, requestOptions } = createRequest({
        url: `${baseUrl}/`
      });
      const { hostname: virtualScriptId } = new URL(requestOptions.url);
      const virtualScript = new VirtualScript(
        virtualScriptId,
        VirtualScriptType.LOCAL,
        'console.log("test code");'
      );
      const spiedVirtualScript = spy(virtualScript);
      when(spiedVirtualScript.exec(anyString(), anything())).thenResolve(
        requestOptions
      );
      when(virtualScriptsMock.find(virtualScriptId)).thenReturn(virtualScript);
      const sut = buildSut();

      // act
      await sut.execute(request);

      // assert
      verify(spiedVirtualScript.exec(anyString(), anything())).once();
    });

    it('should not transform the request if there is no suitable vm', async () => {
      // arrange
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });
      const { request, spiedRequest } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut();

      // act
      await sut.execute(request);

      // assert
      verify(spiedRequest.toJSON()).never();
    });

    it('should call loadCert on the provided request if there were certificates configured globally', async () => {
      // arrange
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });
      const { request, spiedRequest } = createRequest({ url: `${baseUrl}/` });
      const certs: Cert[] = [
        {
          path: '/tmp/cert.pem',
          hostname: new URL(request.url).hostname
        }
      ];
      when(certificatesResolverMock.resolve(request, anything())).thenReturn(
        certs
      );
      const sut = buildSut({ certs });

      // act
      await sut.execute(request);

      // assert
      verify(spiedRequest.loadCert(anything())).once();
    });

    it('should not call loadCert on the provided request if there were no certificates configured', async () => {
      // arrange
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });
      const { request, spiedRequest } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut();

      // act
      await sut.execute(request);

      // assert
      verify(spiedRequest.loadCert(anything())).never();
    });

    it('should perform an external http request', async () => {
      // arrange
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut();

      // act
      const response = await sut.execute(request);

      // assert
      expect(response).toMatchObject({ statusCode: 200, body: '{}' });
    });

    it('should populate ttfb as a non-negative integer milliseconds value', async () => {
      // arrange
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut();

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.ttfb).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(response.ttfb)).toBe(true);
    });

    it('should not populate ttfb on connection error', async () => {
      // arrange
      const { request } = createRequest({ url: 'http://127.0.0.1:1/' });
      const sut = buildSut();

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.ttfb).toBeUndefined();
    });

    it('should handle HTTP errors', async () => {
      // arrange
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end('{}');
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut();

      // act
      const response = await sut.execute(request);

      // assert
      expect(response).toMatchObject({ statusCode: 500, body: '{}' });
    });

    it('should preserve directory traversal', async () => {
      // arrange
      const path = '/public/../../../../../../etc/passwd';
      let receivedPath: string;
      const { baseUrl } = await startServer((req, res) => {
        receivedPath = req.url;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });
      const { request } = createRequest({ url: `${baseUrl}${path}` });
      const sut = buildSut();

      // act
      const response = await sut.execute(request);

      // assert
      expect(response).toMatchObject({ statusCode: 200 });
      expect(receivedPath).toBe(path);
    });

    it('should preserve query string when URL has no explicit path', async () => {
      // arrange
      let receivedPath: string;
      const { port } = await startServer((req, res) => {
        receivedPath = req.url;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });
      const { request } = createRequest({
        url: `http://127.0.0.1:${port}?x=1&y=2`
      });
      const sut = buildSut();

      // act
      const response = await sut.execute(request);

      // assert
      expect(response).toMatchObject({ statusCode: 200 });
      expect(receivedPath).toBe('/?x=1&y=2');
    });

    it('should handle timeout', async () => {
      // arrange
      const { baseUrl } = await startServer((_req, _res) => {
        // Never respond — triggers timeout
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut({ timeout: 50 });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response).toMatchObject({ errorCode: expect.any(String) });
    });

    it('should handle non-HTTP errors (connection refused)', async () => {
      // arrange
      const { request } = createRequest({
        url: 'http://127.0.0.1:1/'
      });
      const sut = buildSut();

      // act
      const response = await sut.execute(request);

      // assert
      expect(response).toMatchObject({ statusCode: undefined });
    });

    it('should truncate response body with not white-listed mime type', async () => {
      // arrange
      const bigBody = 'x'.repeat(1025);
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/x-custom' });
        res.end(bigBody);
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut({ maxContentLength: 1 });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body?.length).toEqual(1024);
      expect(response.body).toEqual(bigBody.slice(0, 1024));
    });

    it('should not truncate response body if its smaller than limit and it is in allowed mime types', async () => {
      // arrange
      const bigBody = 'x'.repeat(1025);
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/x-custom' });
        res.end(bigBody);
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut({
        maxBodySize: 1025,
        whitelistMimes: [
          { type: 'application/x-custom', allowTruncation: false }
        ]
      });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual(bigBody);
    });

    it('should truncate response body if its larger than limit and it is in allowed mime types that require truncation', async () => {
      // arrange
      const bigBody = 'x'.repeat(1025);
      const expected = bigBody.slice(0, 1024);
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(bigBody);
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut({
        maxBodySize: 1024,
        whitelistMimes: [{ type: 'text/plain', allowTruncation: true }]
      });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual(expected);
    });

    it('should omit response body if its larger than limit and it is in allowed mime types that require omission', async () => {
      // arrange
      const bigBody = 'x'.repeat(1025);
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(bigBody);
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut({
        maxBodySize: 1024,
        whitelistMimes: [{ type: 'application/json', allowTruncation: false }]
      });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual('');
    });

    it('should decode response body if content-encoding is brotli', async () => {
      // arrange
      const expected = 'x'.repeat(100);
      const compressed = await promisify(brotliCompress)(expected);
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'br'
        });
        res.end(compressed);
      });
      const { request } = createRequest({
        url: `${baseUrl}/`,
        decompress: true
      });
      const sut = buildSut({
        maxBodySize: 2000,
        whitelistMimes: [{ type: 'text/plain', allowTruncation: true }]
      });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual(expected);
    });

    it('should prevent decoding response body if decompress option is disabled', async () => {
      // arrange
      const expected = 'x'.repeat(100);
      const compressed = await promisify(gzip)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'gzip'
        });
        res.end(compressed);
      });
      const { request } = createRequest({
        url: `${baseUrl}/`,
        decompress: false,
        encoding: 'base64'
      });
      const sut = buildSut({
        maxBodySize: 2000,
        whitelistMimes: [{ type: 'text/plain', allowTruncation: true }]
      });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual(compressed.toString('base64'));
      expect(response.headers).toMatchObject({ 'content-encoding': 'gzip' });
    });

    it('should decode response body if content-encoding is gzip', async () => {
      // arrange
      const expected = 'x'.repeat(100);
      const compressed = await promisify(gzip)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'gzip'
        });
        res.end(compressed);
      });
      const { request } = createRequest({
        url: `${baseUrl}/`,
        decompress: true
      });
      const sut = buildSut({
        maxBodySize: 2000,
        whitelistMimes: [{ type: 'text/plain', allowTruncation: true }]
      });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual(expected);
    });

    it('should decode response body if content-encoding is deflate', async () => {
      // arrange
      const expected = 'x'.repeat(100);
      const compressed = await promisify(deflate)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'deflate'
        });
        res.end(compressed);
      });
      const { request } = createRequest({
        url: `${baseUrl}/`,
        decompress: true
      });
      const sut = buildSut({
        maxBodySize: 2000,
        whitelistMimes: [{ type: 'text/plain', allowTruncation: true }]
      });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual(expected);
    });

    it('should decode response body if content-encoding is deflate and content does not have zlib headers', async () => {
      // arrange
      const expected = 'x'.repeat(100);
      const compressed = await promisify(deflateRaw)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'deflate'
        });
        res.end(compressed);
      });
      const { request } = createRequest({
        url: `${baseUrl}/`,
        decompress: true
      });
      const sut = buildSut({
        maxBodySize: 2000,
        whitelistMimes: [{ type: 'text/plain', allowTruncation: true }]
      });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual(expected);
    });

    it('should decode and truncate gzipped response body if content-type is not in allowed list', async () => {
      // arrange
      const bigBody = 'x'.repeat(1025);
      const expected = bigBody.slice(0, 1024);
      const compressed = await promisify(gzip)(bigBody, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/html',
          'content-encoding': 'gzip'
        });
        res.end(compressed);
      });
      const { request } = createRequest({
        url: `${baseUrl}/`,
        decompress: true
      });
      const sut = buildSut({
        maxContentLength: 1,
        whitelistMimes: [{ type: 'text/plain', allowTruncation: true }]
      });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual(expected);
    });

    it('should not truncate response body if allowed mime type starts with actual one', async () => {
      // arrange
      const bigBody = 'x'.repeat(1025);
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'application/x-custom-with-suffix'
        });
        res.end(bigBody);
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut({
        maxBodySize: 1025,
        whitelistMimes: [
          { type: 'application/x-custom', allowTruncation: false }
        ]
      });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual(bigBody);
    });

    it('should skip truncate on 204 response status', async () => {
      // arrange
      const { baseUrl } = await startServer((_req, res) => {
        res.writeHead(204);
        res.end();
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut({ maxContentLength: 1 });

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.body).toEqual('');
    });

    it('should send requests with unescaped characters in the path (Case 1)', async () => {
      // arrange
      let receivedPath: string;
      const { port } = await startServer((req, res) => {
        receivedPath = req.url;
        res.writeHead(200);
        res.end('ok');
      });
      const { request } = createRequest({
        url: `http://127.0.0.1:${port}/path|with|pipes`
      });
      const sut = buildSut();

      // act
      const response = await sut.execute(request);

      // assert
      expect(response.statusCode).toBe(200);
      expect(receivedPath).toBe('/path|with|pipes');
    });

    it('should write a malformed path verbatim on the wire', async () => {
      // arrange
      // Paths containing characters that are illegal in an HTTP request-line
      // (e.g. spaces and colons that mimic a status line) must be forwarded
      // exactly as supplied. A raw TCP server is used to capture the bytes
      // before any HTTP parsing can strip or reject them.
      const fixture = await startServer();
      const rawPath = '/?msg=Server: ESA1 HTTP/1.1';
      const { request } = createRequest({
        url: `http://127.0.0.1:${fixture.port}${rawPath}`
      });
      const sut = buildSut();

      // act
      // Run the executor and the TCP capture concurrently: execute() will
      // block until it gets an HTTP response, which the TCP server sends as
      // soon as it receives the request.
      const results = await Promise.all([
        sut.execute(request),
        fixture.received()
      ]);
      fixture.close();

      // assert
      expect(extractRequestLine(results[1])).toBe(`GET ${rawPath} HTTP/1.1`);
    });

    it('should not send the libcurl default User-Agent header', async () => {
      // arrange
      let receivedUserAgent: string | undefined;
      const { baseUrl } = await startServer((req, res) => {
        receivedUserAgent = req.headers['user-agent'];
        res.writeHead(200);
        res.end('ok');
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut();

      // act
      await sut.execute(request);

      // assert
      expect(receivedUserAgent).toBeUndefined();
    });

    it('should preserve a caller-supplied User-Agent header', async () => {
      // arrange
      let receivedUserAgent: string | undefined;
      const { baseUrl } = await startServer((req, res) => {
        receivedUserAgent = req.headers['user-agent'];
        res.writeHead(200);
        res.end('ok');
      });
      const { request } = createRequest({
        url: `${baseUrl}/`,
        headers: { 'User-Agent': 'my-scanner/1.0' }
      });
      const sut = buildSut();

      // act
      await sut.execute(request);

      // assert
      expect(receivedUserAgent).toBe('my-scanner/1.0');
    });

    it('should forward a caller-supplied Host header verbatim to the server', async () => {
      // arrange
      // The scanner sends security-test payloads in the Host header (e.g. Host
      // injection, SSRF probes). The value must reach the server byte-for-byte;
      // libcurl's URL-derived Host is overridden by the HTTPHEADER entry.
      let receivedHeaders: http.IncomingHttpHeaders | undefined;
      const { baseUrl } = await startServer((req, res) => {
        receivedHeaders = req.headers;
        res.writeHead(200);
        res.end('ok');
      });
      const { request } = createRequest({
        url: `${baseUrl}/`,
        headers: { host: 'evil.example.com' }
      });
      const sut = buildSut();

      // act
      await sut.execute(request);

      // assert
      expect(receivedHeaders?.['host']).toBe('evil.example.com');
    });

    it('should forward a Host header containing an injection payload verbatim', async () => {
      // arrange
      let receivedHeaders: http.IncomingHttpHeaders | undefined;
      const { baseUrl } = await startServer((req, res) => {
        receivedHeaders = req.headers;
        res.writeHead(200);
        res.end('ok');
      });
      const injectionPayload = 'evil.internal; X-Forwarded-Host: attacker.com';
      const { request } = createRequest({
        url: `${baseUrl}/some-proper-url`,
        headers: { host: injectionPayload }
      });
      const sut = buildSut();

      // act
      await sut.execute(request);

      // assert
      expect(receivedHeaders?.['host']).toBe(injectionPayload);
    });

    it('should send Authorization header when URL contains embedded credentials', async () => {
      // arrange
      let receivedAuthorization: string | undefined;
      const { port } = await startServer((req, res) => {
        receivedAuthorization = req.headers['authorization'];
        res.writeHead(200);
        res.end('ok');
      });
      const { request } = createRequest({
        url: `http://user:password@127.0.0.1:${port}/`
      });
      const sut = buildSut();

      // act
      await sut.execute(request);

      // assert
      // libcurl sends HTTP Basic auth when USERPWD is set
      expect(receivedAuthorization).toBe(
        `Basic ${Buffer.from('user:password').toString('base64')}`
      );
    });

    it('should not send Authorization header when URL has no embedded credentials', async () => {
      // arrange
      let receivedAuthorization: string | undefined;
      const { baseUrl } = await startServer((req, res) => {
        receivedAuthorization = req.headers['authorization'];
        res.writeHead(200);
        res.end('ok');
      });
      const { request } = createRequest({ url: `${baseUrl}/` });
      const sut = buildSut();

      // act
      await sut.execute(request);

      // assert
      expect(receivedAuthorization).toBeUndefined();
    });
  });

  it('should include ttfb in a successful response', async () => {
    // arrange
    const { baseUrl } = await startServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    const { request } = createRequest({ url: `${baseUrl}/` });
    const sut = buildSut();

    // act
    const response = await sut.execute(request);

    // assert
    expect(response.ttfb).toBeGreaterThanOrEqual(0);
  });

  it('should include ttfb even on HTTP error responses', async () => {
    // arrange
    const { baseUrl } = await startServer((_req, res) => {
      res.writeHead(500);
      res.end('error body');
    });
    const { request } = createRequest({ url: `${baseUrl}/` });
    const sut = buildSut();

    // act
    const response = await sut.execute(request);

    // assert
    expect(response.statusCode).toBe(500);
    expect(response.ttfb).toBeDefined();
  });

  it('should not include ttfb when the request fails before reaching the target', async () => {
    // arrange
    const { request } = createRequest({ url: 'http://127.0.0.1:1/' });
    const sut = buildSut();

    // act
    const response = await sut.execute(request);

    // assert
    expect(response.errorCode).toBeDefined();
    expect(response.ttfb).toBeUndefined();
  });

  it('should reuse the TCP connection across requests when reuseConnection is true', async () => {
    // arrange
    // Connection reuse is provided by a per-host Multi handle whose
    // connection pool survives individual Curl handle teardown.
    // When reuseConnection is true we set TCP_KEEPALIVE and TCP_KEEPIDLE and
    // wire each Curl handle to a dedicated per-host Multi so that
    // MAX_HOST_CONNECTIONS applies per origin.
    let connectionCount = 0;
    const { server, baseUrl } = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    server.on('connection', () => {
      connectionCount++;
    });
    const reuseExecutor = new HttpRequestExecutor(
      instance(virtualScriptsMock),
      { reuseConnection: true },
      certificatesCacheMock,
      instance(certificatesResolverMock)
    );
    const { request: req1 } = createRequest({ url: `${baseUrl}/a` });
    const { request: req2 } = createRequest({ url: `${baseUrl}/b` });
    const { request: req3 } = createRequest({ url: `${baseUrl}/c` });

    // act
    await reuseExecutor.execute(req1);
    await reuseExecutor.execute(req2);
    await reuseExecutor.execute(req3);

    // assert
    // All three requests should travel over the same TCP connection.
    expect(connectionCount).toBe(1);
  });

  it('should open a new TCP connection for each request when reuseConnection is false', async () => {
    // arrange
    // When reuseConnection is false we set FRESH_CONNECT and FORBID_REUSE
    // to match the node default-off keepAlive behaviour, ensuring each
    // request opens a fresh TCP connection.
    let connectionCount = 0;
    const { server, baseUrl } = await startServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    server.on('connection', () => {
      connectionCount++;
    });
    const { request: req1 } = createRequest({ url: `${baseUrl}/a` });
    const { request: req2 } = createRequest({ url: `${baseUrl}/b` });
    const sut = buildSut();

    // act
    await sut.execute(req1);
    await sut.execute(req2);

    // assert
    expect(connectionCount).toBe(2);
  });

  it('should send Connection: close header on the wire when reuseConnection is false', async () => {
    // arrange
    // FRESH_CONNECT / FORBID_REUSE are client-side only; the server still needs
    // to be told to close the connection.  The executor must inject the header
    // when the caller has not supplied one.
    const fixture = await startServer();
    const { request } = createRequest({
      url: `http://127.0.0.1:${fixture.port}/`
    });
    const sut = buildSut();

    // act
    const results = await Promise.all([
      sut.execute(request),
      fixture.received()
    ]);
    fixture.close();

    // assert
    const headers = results[1].toLowerCase();
    expect(headers).toContain('connection: close');
  });

  it('should not duplicate Connection header when the caller already supplies one', async () => {
    // arrange
    // If the caller provides their own Connection header (e.g. "keep-alive")
    // the executor must NOT append an additional Connection: close line.
    const fixture = await startServer();
    const { request } = createRequest({
      url: `http://127.0.0.1:${fixture.port}/`,
      headers: { Connection: 'keep-alive' }
    });
    const sut = buildSut();

    // act
    const results = await Promise.all([
      sut.execute(request),
      fixture.received()
    ]);
    fixture.close();

    // assert
    const connectionHeaders = results[1]
      .split('\r\n')
      .filter((line) => line.toLowerCase().startsWith('connection:'));
    expect(connectionHeaders).toHaveLength(1);
    expect(connectionHeaders[0].toLowerCase()).toBe('connection: keep-alive');
  });

  it('should reuse the same Multi handle for multiple requests to the same host', async () => {
    // arrange
    const { baseUrl } = await startServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    const sut = buildSut({ reuseConnection: true });
    const { request: req1 } = createRequest({ url: `${baseUrl}/a` });
    const { request: req2 } = createRequest({ url: `${baseUrl}/b` });
    const { request: req3 } = createRequest({ url: `${baseUrl}/c` });

    // act
    await sut.execute(req1);
    await sut.execute(req2);
    await sut.execute(req3);

    // assert
    expect(MultiSpy).toHaveBeenCalledTimes(1);
  });

  describe('rawHeaders injection', () => {
    it('should include a raw header line in the outgoing request at the correct position', async () => {
      // arrange
      const { baseUrl, received, close } = await startServer();
      const sut = buildSut();
      const rawLine =
        ';response.writeHead(200, {"token": "token"});response.write("token");';
      const { request } = createRequest({
        url: `${baseUrl}/path`,
        headers: {
          'accept': 'application/json', // index 0
          'x-after-raw': 'after' //       index 1
        },
        rawHeaders: [{ index: 1, line: rawLine }]
      });

      // act
      await sut.execute(request);

      const raw = await received();
      close();

      // assert: raw line is in the request
      expect(raw).toContain(rawLine);
      // and it appears between 'accept' and 'x-after-raw'
      const rawIdx = raw.indexOf(rawLine);
      const acceptIdx = raw.toLowerCase().indexOf('accept:');
      const afterIdx = raw.toLowerCase().indexOf('x-after-raw:');
      expect(rawIdx).toBeGreaterThan(acceptIdx);
      expect(rawIdx).toBeLessThan(afterIdx);
    });

    it('should include multiple raw header lines in the correct order', async () => {
      // arrange
      const { baseUrl, received, close } = await startServer();
      const sut = buildSut();
      const lineA = ';first-malformed-header';
      const lineB = ';second-malformed-header';
      const { request } = createRequest({
        url: `${baseUrl}/path`,
        headers: {
          'accept': 'text/plain', // index 0
          'x-after': 'value' //      index 1
        },
        rawHeaders: [
          { index: 1, line: lineA },
          { index: 2, line: lineB }
        ]
      });

      // act
      await sut.execute(request);

      const raw = await received();
      close();

      // assert
      const idxA = raw.indexOf(lineA);
      const idxB = raw.indexOf(lineB);
      const idxAfter = raw.toLowerCase().indexOf('x-after:');

      expect(idxA).toBeGreaterThan(-1);
      expect(idxB).toBeGreaterThan(-1);
      // A before B, both before x-after
      expect(idxA).toBeLessThan(idxB);
      expect(idxA).toBeLessThan(idxAfter);
      expect(idxB).toBeLessThan(idxAfter);
    });

    it('should not include raw headers when rawHeaders is absent', async () => {
      // arrange
      const { baseUrl, received, close } = await startServer();
      const sut = buildSut();
      const { request } = createRequest({
        url: `${baseUrl}/path`,
        headers: { accept: 'application/json' }
      });

      // act
      await sut.execute(request);

      const raw = await received();
      close();

      // assert: no semicolon-prefixed header lines
      const headerLines = raw
        .split('\r\n')
        .slice(1) // skip request-line
        .filter((l) => l.length > 0);
      expect(headerLines.every((l) => !l.startsWith(';'))).toBe(true);
    });
  });
});

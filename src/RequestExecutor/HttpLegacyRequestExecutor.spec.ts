import 'reflect-metadata';
import { HttpLegacyRequestExecutor } from './HttpLegacyRequestExecutor';
import { VirtualScript, VirtualScripts, VirtualScriptType } from '../Scripts';
import { Protocol } from './Protocol';
import { Request, RequestOptions, Cert } from './Request';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
import { ProxyFactory } from '../Utils';
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
import { AddressInfo } from 'node:net';
import { promisify } from 'node:util';
import {
  brotliCompress,
  constants,
  gzip,
  deflate,
  deflateRaw
} from 'node:zlib';

const serversToClose: http.Server[] = [];

/**
 * Creates a minimal HTTP server that responds once per request.
 * Returns the server instance and its base URL.
 */
async function createTestServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  serversToClose.push(server);

  return { server, baseUrl: `http://127.0.0.1:${port}` };
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

describe('HttpLegacyRequestExecutor', () => {
  const virtualScriptsMock = mock<VirtualScripts>();
  const certificatesCacheMock = mock<CertificatesCache>();
  const certificatesResolverMock = mock<CertificatesResolver>();
  const proxyFactoryMock = mock<ProxyFactory>();
  let spiedExecutorOptions!: RequestExecutorOptions;

  let executor!: HttpLegacyRequestExecutor;

  beforeEach(() => {
    spiedExecutorOptions = {} as RequestExecutorOptions;

    executor = new HttpLegacyRequestExecutor(
      instance(virtualScriptsMock),
      instance(proxyFactoryMock),
      spiedExecutorOptions,
      certificatesCacheMock,
      instance(certificatesResolverMock)
    );
  });

  afterEach(() => {
    reset<
      | VirtualScripts
      | RequestExecutorOptions
      | CertificatesCache
      | CertificatesResolver
      | ProxyFactory
    >(
      virtualScriptsMock,
      certificatesCacheMock,
      certificatesResolverMock,
      proxyFactoryMock
    );

    return Promise.all(
      serversToClose.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.closeAllConnections();
            server.close(() => resolve());
          })
      )
    );
  });

  describe('protocol', () => {
    it('should return HTTP', () => {
      const protocol = executor.protocol;
      expect(protocol).toBe(Protocol.HTTP);
    });
  });

  describe('execute', () => {
    it('should call setHeaders on the provided request if additional headers were configured globally', async () => {
      const headers = { testHeader: 'test-header-value' };
      spiedExecutorOptions.headers = headers;
      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });

      try {
        const { request, spiedRequest } = createRequest({ url: `${baseUrl}/` });
        await executor.execute(request);
        verify(spiedRequest.setHeaders(headers)).once();
      } finally {
        server.close();
      }
    });

    it('should not call setHeaders on the provided request if there were no additional headers configured', async () => {
      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });

      try {
        const { request, spiedRequest } = createRequest({ url: `${baseUrl}/` });
        await executor.execute(request);
        verify(spiedRequest.setHeaders(anything())).never();
      } finally {
        server.close();
      }
    });

    it('should transform the request if there is a suitable vm', async () => {
      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });

      try {
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
        when(virtualScriptsMock.find(virtualScriptId)).thenReturn(
          virtualScript
        );

        await executor.execute(request);

        verify(spiedVirtualScript.exec(anyString(), anything())).once();
      } finally {
        server.close();
      }
    });

    it('should not transform the request if there is no suitable vm', async () => {
      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });

      try {
        const { request, spiedRequest } = createRequest({ url: `${baseUrl}/` });
        await executor.execute(request);
        verify(spiedRequest.toJSON()).never();
      } finally {
        server.close();
      }
    });

    it('should call loadCert on the provided request if there were certificates configured globally', async () => {
      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });

      try {
        const { request, spiedRequest } = createRequest({ url: `${baseUrl}/` });
        const certs: Cert[] = [
          {
            path: '/tmp/cert.pem',
            hostname: new URL(request.url).hostname
          }
        ];
        spiedExecutorOptions.certs = certs;
        when(certificatesResolverMock.resolve(request, anything())).thenReturn(
          certs
        );

        await executor.execute(request);

        verify(spiedRequest.loadCert(anything())).once();
      } finally {
        server.close();
      }
    });

    it('should not call loadCert on the provided request if there were no certificates configured', async () => {
      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });

      try {
        const { request, spiedRequest } = createRequest({ url: `${baseUrl}/` });
        await executor.execute(request);
        verify(spiedRequest.loadCert(anything())).never();
      } finally {
        server.close();
      }
    });

    it('should perform an external http request', async () => {
      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}/` });
        const response = await executor.execute(request);
        expect(response).toMatchObject({ statusCode: 200, body: '{}' });
      } finally {
        server.close();
      }
    });

    it('should handle HTTP errors', async () => {
      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end('{}');
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}/` });
        const response = await executor.execute(request);
        expect(response).toMatchObject({ statusCode: 500, body: '{}' });
      } finally {
        server.close();
      }
    });

    it('should preserve directory traversal', async () => {
      const path = '/public/../../../../../../etc/passwd';
      let receivedPath: string;

      const { server, baseUrl } = await createTestServer((req, res) => {
        receivedPath = req.url;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}${path}` });
        const response = await executor.execute(request);
        expect(response).toMatchObject({ statusCode: 200 });
        expect(receivedPath).toBe(path);
      } finally {
        server.close();
      }
    });

    it('should preserve query string when URL has no explicit path', async () => {
      let receivedPath: string;
      const { server } = await createTestServer((req, res) => {
        receivedPath = req.url;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });

      try {
        const { port } = server.address() as AddressInfo;
        const { request } = createRequest({
          url: `http://127.0.0.1:${port}?x=1&y=2`
        });
        const response = await executor.execute(request);
        expect(response).toMatchObject({ statusCode: 200 });
        expect(receivedPath).toBe('/?x=1&y=2');
      } finally {
        server.close();
      }
    });

    it('should handle timeout', async () => {
      spiedExecutorOptions.timeout = 50;
      const { server, baseUrl } = await createTestServer((_req, _res) => {
        // Never respond — triggers timeout
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}/` });
        const response = await executor.execute(request);
        expect(response).toMatchObject({ errorCode: expect.any(String) });
      } finally {
        server.close();
      }
    });

    it('should handle non-HTTP errors (connection refused)', async () => {
      // Port 1 is not listening — expect a connection error
      const { request } = createRequest({
        url: 'http://127.0.0.1:1/'
      });

      const response = await executor.execute(request);

      expect(response).toMatchObject({ statusCode: undefined });
    });

    it('should truncate response body with not white-listed mime type', async () => {
      spiedExecutorOptions.maxContentLength = 1;
      const bigBody = 'x'.repeat(1025);

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/x-custom' });
        res.end(bigBody);
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}/` });
        const response = await executor.execute(request);
        expect(response.body?.length).toEqual(1024);
        expect(response.body).toEqual(bigBody.slice(0, 1024));
      } finally {
        server.close();
      }
    });

    it('should not truncate response body if its smaller than limit and it is in allowed mime types', async () => {
      spiedExecutorOptions.maxBodySize = 1025;
      spiedExecutorOptions.whitelistMimes = [
        { type: 'application/x-custom', allowTruncation: false }
      ];
      const bigBody = 'x'.repeat(1025);

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/x-custom' });
        res.end(bigBody);
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}/` });
        const response = await executor.execute(request);
        expect(response.body).toEqual(bigBody);
      } finally {
        server.close();
      }
    });

    it('should truncate response body if its larger than limit and it is in allowed mime types that require truncation', async () => {
      spiedExecutorOptions.maxBodySize = 1024;
      spiedExecutorOptions.whitelistMimes = [
        { type: 'text/plain', allowTruncation: true }
      ];
      const bigBody = 'x'.repeat(1025);
      const expected = bigBody.slice(0, 1024);

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(bigBody);
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}/` });
        const response = await executor.execute(request);
        expect(response.body).toEqual(expected);
      } finally {
        server.close();
      }
    });

    it('should omit response body if its larger than limit and it is in allowed mime types that require omission', async () => {
      spiedExecutorOptions.maxBodySize = 1024;
      spiedExecutorOptions.whitelistMimes = [
        { type: 'application/json', allowTruncation: false }
      ];
      const bigBody = 'x'.repeat(1025);

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(bigBody);
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}/` });
        const response = await executor.execute(request);
        expect(response.body).toEqual('');
      } finally {
        server.close();
      }
    });

    it('should decode response body if content-encoding is brotli', async () => {
      spiedExecutorOptions.maxBodySize = 2000;
      spiedExecutorOptions.whitelistMimes = [
        { type: 'text/plain', allowTruncation: true }
      ];
      const expected = 'x'.repeat(100);
      const compressed = await promisify(brotliCompress)(expected);

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'br'
        });
        res.end(compressed);
      });

      try {
        const { request } = createRequest({
          url: `${baseUrl}/`,
          decompress: true
        });
        const response = await executor.execute(request);
        expect(response.body).toEqual(expected);
      } finally {
        server.close();
      }
    });

    it('should prevent decoding response body if decompress option is disabled', async () => {
      spiedExecutorOptions.maxBodySize = 2000;
      spiedExecutorOptions.whitelistMimes = [
        { type: 'text/plain', allowTruncation: true }
      ];
      const expected = 'x'.repeat(100);
      const compressed = await promisify(gzip)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'gzip'
        });
        res.end(compressed);
      });

      try {
        const { request } = createRequest({
          url: `${baseUrl}/`,
          decompress: false,
          encoding: 'base64'
        });
        const response = await executor.execute(request);
        expect(response.body).toEqual(compressed.toString('base64'));
        expect(response.headers).toMatchObject({ 'content-encoding': 'gzip' });
      } finally {
        server.close();
      }
    });

    it('should decode response body if content-encoding is gzip', async () => {
      spiedExecutorOptions.maxBodySize = 2000;
      spiedExecutorOptions.whitelistMimes = [
        { type: 'text/plain', allowTruncation: true }
      ];
      const expected = 'x'.repeat(100);
      const compressed = await promisify(gzip)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'gzip'
        });
        res.end(compressed);
      });

      try {
        const { request } = createRequest({
          url: `${baseUrl}/`,
          decompress: true
        });
        const response = await executor.execute(request);
        expect(response.body).toEqual(expected);
      } finally {
        server.close();
      }
    });

    it('should decode response body if content-encoding is deflate', async () => {
      spiedExecutorOptions.maxBodySize = 2000;
      spiedExecutorOptions.whitelistMimes = [
        { type: 'text/plain', allowTruncation: true }
      ];
      const expected = 'x'.repeat(100);
      const compressed = await promisify(deflate)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'deflate'
        });
        res.end(compressed);
      });

      try {
        const { request } = createRequest({
          url: `${baseUrl}/`,
          decompress: true
        });
        const response = await executor.execute(request);
        expect(response.body).toEqual(expected);
      } finally {
        server.close();
      }
    });

    it('should decode response body if content-encoding is deflate and content does not have zlib headers', async () => {
      spiedExecutorOptions.maxBodySize = 2000;
      spiedExecutorOptions.whitelistMimes = [
        { type: 'text/plain', allowTruncation: true }
      ];
      const expected = 'x'.repeat(100);
      const compressed = await promisify(deflateRaw)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/plain',
          'content-encoding': 'deflate'
        });
        res.end(compressed);
      });

      try {
        const { request } = createRequest({
          url: `${baseUrl}/`,
          decompress: true
        });
        const response = await executor.execute(request);
        expect(response.body).toEqual(expected);
      } finally {
        server.close();
      }
    });

    it('should decode and truncate gzipped response body if content-type is not in allowed list', async () => {
      spiedExecutorOptions.maxContentLength = 1;
      spiedExecutorOptions.whitelistMimes = [
        { type: 'text/plain', allowTruncation: true }
      ];
      const bigBody = 'x'.repeat(1025);
      const expected = bigBody.slice(0, 1024);
      const compressed = await promisify(gzip)(bigBody, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'text/html',
          'content-encoding': 'gzip'
        });
        res.end(compressed);
      });

      try {
        const { request } = createRequest({
          url: `${baseUrl}/`,
          decompress: true
        });
        const response = await executor.execute(request);
        expect(response.body).toEqual(expected);
      } finally {
        server.close();
      }
    });

    it('should not truncate response body if allowed mime type starts with actual one', async () => {
      spiedExecutorOptions.maxBodySize = 1025;
      spiedExecutorOptions.whitelistMimes = [
        { type: 'application/x-custom', allowTruncation: false }
      ];
      const bigBody = 'x'.repeat(1025);

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, {
          'content-type': 'application/x-custom-with-suffix'
        });
        res.end(bigBody);
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}/` });
        const response = await executor.execute(request);
        expect(response.body).toEqual(bigBody);
      } finally {
        server.close();
      }
    });

    it('should skip truncate on 204 response status', async () => {
      spiedExecutorOptions.maxContentLength = 1;

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(204);
        res.end();
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}/` });
        const response = await executor.execute(request);
        expect(response.body).toEqual('');
      } finally {
        server.close();
      }
    });

    it('should send requests preserving the path as constructed from url.parse', async () => {
      // Node.js http module percent-encodes characters such as "|" in the
      // request path (unlike libcurl with PATH_AS_IS). The legacy executor
      // faithfully sends whatever path Node.js derives from url.parse(), so
      // the receiver sees the encoded form.
      let receivedPath: string;

      const { server } = await createTestServer((req, res) => {
        receivedPath = req.url;
        res.writeHead(200);
        res.end('ok');
      });

      try {
        const { port } = server.address() as AddressInfo;
        const { request } = createRequest({
          url: `http://127.0.0.1:${port}/path|with|pipes`
        });
        const response = await executor.execute(request);
        expect(response.statusCode).toBe(200);
        // Node.js encodes "|" as "%7C"; the path is not preserved verbatim
        // the way libcurl's PATH_AS_IS option does.
        expect(receivedPath).toBe('/path%7Cwith%7Cpipes');
      } finally {
        server.close();
      }
    });

    it('should not send a default User-Agent header', async () => {
      // Node.js http client does not add a User-Agent header by default.
      let receivedUserAgent: string | undefined;

      const { server, baseUrl } = await createTestServer((req, res) => {
        receivedUserAgent = req.headers['user-agent'];
        res.writeHead(200);
        res.end('ok');
      });

      try {
        const { request } = createRequest({ url: `${baseUrl}/` });
        await executor.execute(request);
        expect(receivedUserAgent).toBeUndefined();
      } finally {
        server.close();
      }
    });

    it('should preserve a caller-supplied User-Agent header', async () => {
      let receivedUserAgent: string | undefined;

      const { server, baseUrl } = await createTestServer((req, res) => {
        receivedUserAgent = req.headers['user-agent'];
        res.writeHead(200);
        res.end('ok');
      });

      try {
        const { request } = createRequest({
          url: `${baseUrl}/`,
          headers: { 'User-Agent': 'my-scanner/1.0' }
        });
        await executor.execute(request);
        expect(receivedUserAgent).toBe('my-scanner/1.0');
      } finally {
        server.close();
      }
    });

    it('should forward a caller-supplied Host header verbatim to the server', async () => {
      // The scanner sends security-test payloads in the Host header (e.g. Host
      // injection, SSRF probes). The value must reach the server byte-for-byte.
      // HttpLegacyRequestExecutor uses the internal kOutHeaders symbol to
      // bypass Node.js header validation and forward the value as-is.
      let receivedHeaders: http.IncomingHttpHeaders | undefined;

      const { server, baseUrl } = await createTestServer((req, res) => {
        receivedHeaders = req.headers;
        res.writeHead(200);
        res.end('ok');
      });

      try {
        const { request } = createRequest({
          url: `${baseUrl}/`,
          headers: { host: 'evil.example.com' }
        });
        await executor.execute(request);
        expect(receivedHeaders?.['host']).toBe('evil.example.com');
      } finally {
        server.close();
      }
    });

    it('should forward a Host header containing an injection payload verbatim', async () => {
      let receivedHeaders: http.IncomingHttpHeaders | undefined;

      const { server, baseUrl } = await createTestServer((req, res) => {
        receivedHeaders = req.headers;
        res.writeHead(200);
        res.end('ok');
      });

      const injectionPayload = 'evil.internal; X-Forwarded-Host: attacker.com';

      try {
        const { request } = createRequest({
          url: `${baseUrl}/some-proper-url`,
          headers: { host: injectionPayload }
        });
        await executor.execute(request);
        expect(receivedHeaders?.['host']).toBe(injectionPayload);
      } finally {
        server.close();
      }
    });
  });

  it('should include ttfb in a successful response', async () => {
    const { server, baseUrl } = await createTestServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });

    try {
      const { request } = createRequest({ url: `${baseUrl}/` });
      const response = await executor.execute(request);
      expect(response.ttfb).toBeGreaterThanOrEqual(0);
    } finally {
      server.close();
    }
  });

  it('should include ttfb even on HTTP error responses', async () => {
    const { server, baseUrl } = await createTestServer((_req, res) => {
      res.writeHead(500);
      res.end('error body');
    });

    try {
      const { request } = createRequest({ url: `${baseUrl}/` });
      const response = await executor.execute(request);
      expect(response.statusCode).toBe(500);
      expect(response.ttfb).toBeDefined();
    } finally {
      server.close();
    }
  });

  it('should not include ttfb when the request fails before reaching the target', async () => {
    const { request } = createRequest({ url: 'http://127.0.0.1:1/' });
    const response = await executor.execute(request);
    expect(response.errorCode).toBeDefined();
    expect(response.ttfb).toBeUndefined();
  });

  describe('reuseConnection', () => {
    it('should reuse the TCP connection across requests when reuseConnection is true', async () => {
      // When reuseConnection is true the executor creates an http.Agent with
      // keepAlive: true. Requests must also be created with keepAlive: true so
      // the executor does NOT send Connection: close, allowing the socket to
      // stay open and be reused for subsequent requests.
      let connectionCount = 0;

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      });

      server.on('connection', () => {
        connectionCount++;
      });

      const reuseExecutor = new HttpLegacyRequestExecutor(
        instance(virtualScriptsMock),
        instance(proxyFactoryMock),
        { reuseConnection: true },
        certificatesCacheMock,
        instance(certificatesResolverMock)
      );

      try {
        const { request: req1 } = createRequest({
          url: `${baseUrl}/a`,
          keepAlive: true
        });
        const { request: req2 } = createRequest({
          url: `${baseUrl}/b`,
          keepAlive: true
        });
        const { request: req3 } = createRequest({
          url: `${baseUrl}/c`,
          keepAlive: true
        });

        await reuseExecutor.execute(req1);
        await reuseExecutor.execute(req2);
        await reuseExecutor.execute(req3);

        // All three requests should travel over the same TCP connection.
        expect(connectionCount).toBe(1);
      } finally {
        server.close();
      }
    });

    it('should open a new TCP connection for each request when reuseConnection is false', async () => {
      // When reuseConnection is false no keepAlive agent is created. Requests
      // without keepAlive: true send Connection: close, forcing the server to
      // close the socket after each response so every request needs a new TCP
      // connection.
      let connectionCount = 0;

      const { server, baseUrl } = await createTestServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });

      server.on('connection', () => {
        connectionCount++;
      });

      try {
        const { request: req1 } = createRequest({ url: `${baseUrl}/a` });
        const { request: req2 } = createRequest({ url: `${baseUrl}/b` });

        await executor.execute(req1);
        await executor.execute(req2);

        expect(connectionCount).toBe(2);
      } finally {
        server.close();
      }
    });
  });
});

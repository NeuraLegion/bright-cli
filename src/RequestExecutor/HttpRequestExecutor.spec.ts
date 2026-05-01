import 'reflect-metadata';
import { HttpRequestExecutor } from './HttpRequestExecutor';
import { VirtualScript, VirtualScripts, VirtualScriptType } from '../Scripts';
import { Protocol } from './Protocol';
import { Request, RequestOptions, Cert } from './Request';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
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

describe('HttpRequestExecutor', () => {
  const virtualScriptsMock = mock<VirtualScripts>();
  const certificatesCacheMock = mock<CertificatesCache>();
  const certificatesResolverMock = mock<CertificatesResolver>();
  let spiedExecutorOptions!: RequestExecutorOptions;

  let executor!: HttpRequestExecutor;

  beforeEach(() => {
    const executorOptions: RequestExecutorOptions = {};
    spiedExecutorOptions = spy(executorOptions);

    executor = new HttpRequestExecutor(
      instance(virtualScriptsMock),
      executorOptions,
      certificatesCacheMock,
      instance(certificatesResolverMock)
    );
  });

  afterEach(() =>
    reset<
      | VirtualScripts
      | RequestExecutorOptions
      | CertificatesCache
      | CertificatesResolver
    >(
      virtualScriptsMock,
      spiedExecutorOptions,
      certificatesCacheMock,
      certificatesResolverMock
    )
  );

  describe('protocol', () => {
    it('should return HTTP', () => {
      const protocol = executor.protocol;
      expect(protocol).toBe(Protocol.HTTP);
    });
  });

  describe('execute', () => {
    it('should call setHeaders on the provided request if additional headers were configured globally', async () => {
      const headers = { testHeader: 'test-header-value' };
      when(spiedExecutorOptions.headers).thenReturn(headers);
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
        when(spiedExecutorOptions.certs).thenReturn(certs);
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
      when(spiedExecutorOptions.timeout).thenReturn(50);
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
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
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
      when(spiedExecutorOptions.maxBodySize).thenReturn(1025);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        { type: 'application/x-custom', allowTruncation: false }
      ]);
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
      when(spiedExecutorOptions.maxBodySize).thenReturn(1024);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        { type: 'text/plain', allowTruncation: true }
      ]);
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
      when(spiedExecutorOptions.maxBodySize).thenReturn(1024);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        { type: 'application/json', allowTruncation: false }
      ]);
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
      when(spiedExecutorOptions.maxBodySize).thenReturn(2000);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        { type: 'text/plain', allowTruncation: true }
      ]);
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
      when(spiedExecutorOptions.maxBodySize).thenReturn(2000);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        { type: 'text/plain', allowTruncation: true }
      ]);
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
      when(spiedExecutorOptions.maxBodySize).thenReturn(2000);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        { type: 'text/plain', allowTruncation: true }
      ]);
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
      when(spiedExecutorOptions.maxBodySize).thenReturn(2000);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        { type: 'text/plain', allowTruncation: true }
      ]);
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
      when(spiedExecutorOptions.maxBodySize).thenReturn(2000);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        { type: 'text/plain', allowTruncation: true }
      ]);
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
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        { type: 'text/plain', allowTruncation: true }
      ]);
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
      when(spiedExecutorOptions.maxBodySize).thenReturn(1025);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        { type: 'application/x-custom', allowTruncation: false }
      ]);
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
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);

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

    it('should send requests with unescaped characters in the path (Case 1)', async () => {
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
        expect(receivedPath).toBe('/path|with|pipes');
      } finally {
        server.close();
      }
    });

    it('should not send the libcurl default User-Agent header', async () => {
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

    it('should not forward a caller-supplied Host header to avoid duplicate Host', async () => {
      let receivedHeaders: http.IncomingHttpHeaders | undefined;

      const { server, baseUrl } = await createTestServer((req, res) => {
        receivedHeaders = req.headers;
        res.writeHead(200);
        res.end('ok');
      });

      try {
        const { port } = server.address() as AddressInfo;
        const { request } = createRequest({
          url: `${baseUrl}/`,
          headers: { host: 'evil.example.com' }
        });
        await executor.execute(request);
        // libcurl derives Host from the URL; the caller-supplied value must
        // be dropped so the server sees exactly one, correct Host header.
        expect(receivedHeaders?.['host']).toBe(`127.0.0.1:${port}`);
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
      // Connection reuse is provided by node-libcurl's shared global Multi
      // handle, whose connection pool survives individual Curl handle teardown.
      // When reuseConnection is true we omit Connection:close so the server
      // keeps the socket open and libcurl can pick it up for the next request.
      let connectionCount = 0;

      const { server, baseUrl } = await createTestServer((_req, res) => {
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

      try {
        const { request: req1 } = createRequest({ url: `${baseUrl}/a` });
        const { request: req2 } = createRequest({ url: `${baseUrl}/b` });
        const { request: req3 } = createRequest({ url: `${baseUrl}/c` });

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
      // When reuseConnection is false we add Connection:close, instructing the
      // server to close the socket after each response so that a new TCP
      // handshake is required for every subsequent request.
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

import 'reflect-metadata';
import { HttpRequestExecutor } from './HttpRequestExecutor';
import { VirtualScript, VirtualScripts, VirtualScriptType } from '../Scripts';
import { Protocol } from './Protocol';
import { Request, RequestOptions } from './Request';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import nock from 'nock';
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
import { URL } from 'url';
import { promisify } from 'util';
import { brotliCompress, constants, gzip, deflate, deflateRaw } from 'zlib';

const createRequest = (options?: Partial<RequestOptions>) => {
  const requestOptions = {
    url: 'https://foo.bar',
    headers: {},
    protocol: Protocol.HTTP,
    ...options
  };
  const request = new Request(requestOptions);
  const spiedRequest = spy(request);
  when(spiedRequest.method).thenReturn('GET');

  return { requestOptions, request, spiedRequest };
};

describe('HttpRequestExecutor', () => {
  const virtualScriptsMock = mock<VirtualScripts>();
  let spiedExecutorOptions!: RequestExecutorOptions;

  let executor!: HttpRequestExecutor;

  beforeEach(() => {
    const executorOptions: RequestExecutorOptions = {};
    spiedExecutorOptions = spy(executorOptions);

    executor = new HttpRequestExecutor(
      instance(virtualScriptsMock),
      executorOptions
    );
  });

  afterEach(() =>
    reset<VirtualScripts | RequestExecutorOptions>(
      virtualScriptsMock,
      spiedExecutorOptions
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
      const { request, spiedRequest } = createRequest();

      await executor.execute(request);

      verify(spiedRequest.setHeaders(headers)).once();
    });

    it('should not call setHeaders on the provided request if there were no additional headers configured', async () => {
      const { request, spiedRequest } = createRequest();

      await executor.execute(request);

      verify(spiedRequest.setHeaders(anything())).never();
    });

    it('should transform the request if there is a suitable vm', async () => {
      const { request, requestOptions } = createRequest();
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

      await executor.execute(request);

      verify(spiedVirtualScript.exec(anyString(), anything())).once();
    });

    it('should not transform the request if there is no suitable vm', async () => {
      const { request, spiedRequest } = createRequest();

      await executor.execute(request);

      verify(spiedRequest.toJSON()).never();
    });

    it('should call setCerts on the provided request if there were certificates configured globally', async () => {
      when(spiedExecutorOptions.certs).thenReturn([]);
      const { request, spiedRequest } = createRequest();

      await executor.execute(request);

      verify(spiedRequest.setCerts(anything())).once();
    });

    it('should not call setCerts on the provided request if there were no certificates configured', async () => {
      const { request, spiedRequest } = createRequest();

      await executor.execute(request);

      verify(spiedRequest.setCerts(anything())).never();
    });

    it('should perform an external http request', async () => {
      const { request, requestOptions } = createRequest();
      nock(requestOptions.url).get('/').reply(200, {});

      const response = await executor.execute(request);

      expect(response).toMatchObject({
        statusCode: 200,
        body: '{}'
      });
    });

    it('should handle HTTP errors', async () => {
      const { request, requestOptions } = createRequest();
      nock(requestOptions.url).get('/').reply(500, {});

      const response = await executor.execute(request);

      expect(response).toMatchObject({
        statusCode: 500,
        body: '{}'
      });
    });

    it('should preserve directory traversal', async () => {
      const path = 'public/../../../../../../etc/passwd';
      const { request } = createRequest({
        url: `http://localhost:8080/${path}`
      });
      nock('http://localhost:8080').get(`/${path}`).reply(200, {});

      const response = await executor.execute(request);

      expect(response).toMatchObject({
        statusCode: 200,
        body: {}
      });
    });

    it('should handle timeout', async () => {
      when(spiedExecutorOptions.timeout).thenReturn(1);
      const { request, requestOptions } = createRequest();
      nock(requestOptions.url).get('/').delayBody(2).reply(204);

      const response = await executor.execute(request);

      expect(response).toMatchObject({
        errorCode: 'Error',
        message: 'Waiting response has timed out'
      });
    });

    it('should handle non-HTTP errors', async () => {
      const { request } = createRequest();

      const response = await executor.execute(request);

      expect(response).toMatchObject({
        statusCode: undefined
      });
    });

    it('should truncate response body with not white-listed mime type', async () => {
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      const { request, requestOptions } = createRequest();
      const bigBody = 'x'.repeat(1025);
      nock(requestOptions.url)
        .get('/')
        .reply(200, bigBody, { 'content-type': 'application/x-custom' });

      const response = await executor.execute(request);

      expect(response.body?.length).toEqual(1024);
      expect(response.body).toEqual(bigBody.slice(0, 1024));
    });

    it('should not truncate response body if it is in allowed mime types', async () => {
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        'application/x-custom'
      ]);
      const { request, requestOptions } = createRequest();
      const bigBody = 'x'.repeat(1025);
      nock(requestOptions.url).get('/').reply(200, bigBody, {
        'content-type': 'application/x-custom'
      });

      const response = await executor.execute(request);

      expect(response.body).toEqual(bigBody);
    });

    it('should decode response body if content-encoding is brotli', async () => {
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      when(spiedExecutorOptions.whitelistMimes).thenReturn(['text/plain']);
      const { request, requestOptions } = createRequest();
      const expected = 'x'.repeat(1025);
      const bigBody = await promisify(brotliCompress)(expected);
      nock(requestOptions.url).get('/').reply(200, bigBody, {
        'content-type': 'text/plain',
        'content-encoding': 'br'
      });

      const response = await executor.execute(request);

      expect(response.body).toEqual(expected);
    });

    it('should prevent decoding response body if decompress option is disabled', async () => {
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      when(spiedExecutorOptions.whitelistMimes).thenReturn(['text/plain']);
      const { request, requestOptions } = createRequest({
        decompress: false,
        encoding: 'base64'
      });
      const expected = 'x'.repeat(100);
      const body = await promisify(gzip)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });
      nock(requestOptions.url).get('/').reply(200, body, {
        'content-type': 'text/plain',
        'content-encoding': 'gzip'
      });

      const response = await executor.execute(request);

      expect(response.body).toEqual(body.toString('base64'));
      expect(response.headers).toMatchObject({ 'content-encoding': 'gzip' });
    });

    it('should decode response body if content-encoding is gzip', async () => {
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      when(spiedExecutorOptions.whitelistMimes).thenReturn(['text/plain']);
      const { request, requestOptions } = createRequest();
      const expected = 'x'.repeat(1025);
      const bigBody = await promisify(gzip)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });
      nock(requestOptions.url).get('/').reply(200, bigBody, {
        'content-type': 'text/plain',
        'content-encoding': 'gzip'
      });

      const response = await executor.execute(request);

      expect(response.body).toEqual(expected);
    });

    it('should decode response body if content-encoding is deflate', async () => {
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      when(spiedExecutorOptions.whitelistMimes).thenReturn(['text/plain']);
      const { request, requestOptions } = createRequest();
      const expected = 'x'.repeat(1025);
      const bigBody = await promisify(deflate)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });
      nock(requestOptions.url).get('/').reply(200, bigBody, {
        'content-type': 'text/plain',
        'content-encoding': 'deflate'
      });

      const response = await executor.execute(request);

      expect(response.body).toEqual(expected);
    });

    it('should decode response body if content-encoding is deflate and content does not have zlib headers', async () => {
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      when(spiedExecutorOptions.whitelistMimes).thenReturn(['text/plain']);
      const { request, requestOptions } = createRequest();
      const expected = 'x'.repeat(1025);
      const bigBody = await promisify(deflateRaw)(expected, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });
      nock(requestOptions.url).get('/').reply(200, bigBody, {
        'content-type': 'text/plain',
        'content-encoding': 'deflate'
      });

      const response = await executor.execute(request);

      expect(response.body).toEqual(expected);
    });

    it('should decode and truncate gzipped response body if content-type is not in allowed list', async () => {
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      when(spiedExecutorOptions.whitelistMimes).thenReturn(['text/plain']);
      const { request, requestOptions } = createRequest();
      const bigBody = 'x'.repeat(1025);
      const expected = bigBody.slice(0, 1024);
      const gzippedBody = await promisify(gzip)(bigBody, {
        flush: constants.Z_SYNC_FLUSH,
        finishFlush: constants.Z_SYNC_FLUSH
      });
      nock(requestOptions.url).get('/').reply(200, gzippedBody, {
        'content-type': 'text/html',
        'content-encoding': 'gzip'
      });

      const response = await executor.execute(request);

      expect(response.body).toEqual(expected);
    });

    it('should not truncate response body if allowed mime type starts with actual one', async () => {
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      when(spiedExecutorOptions.whitelistMimes).thenReturn([
        'application/x-custom'
      ]);
      const { request, requestOptions } = createRequest();
      const bigBody = 'x'.repeat(1025);
      nock(requestOptions.url).get('/').reply(200, bigBody, {
        'content-type': 'application/x-custom-with-suffix'
      });

      const response = await executor.execute(request);

      expect(response.body).toEqual(bigBody);
    });

    it('should skip truncate on 204 response status', async () => {
      when(spiedExecutorOptions.maxContentLength).thenReturn(1);
      const { request, requestOptions } = createRequest();
      nock(requestOptions.url).get('/').reply(204);
      const response = await executor.execute(request);

      expect(response.body).toEqual('');
    });
  });
});

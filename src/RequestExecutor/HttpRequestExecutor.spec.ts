import 'reflect-metadata';

import { HttpRequestExecutor } from './HttpRequestExecutor';
import {
  DefaultVirtualScripts,
  VirtualScript,
  VirtualScripts
} from '../Scripts';
import { Protocol } from './Protocol';
import { RequestExecutor } from './RequestExecutor';
import { Request } from './Request';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { expect, should } from 'chai';
import nock from 'nock';
import {
  anyString,
  anything,
  instance,
  mock,
  reset,
  verify,
  when
} from 'ts-mockito';
import { container, Lifecycle } from 'tsyringe';

should();

describe('HttpRequestExecutor', () => {
  const VirtualScriptsMock = mock<VirtualScripts>(DefaultVirtualScripts);
  const VirtualScriptMock = mock<VirtualScript>(VirtualScript);
  const RequestExecutorOptionsMock = mock<RequestExecutorOptions>();
  const RequestMock = mock<Request>(Request);

  beforeEach(() => {
    when(VirtualScriptsMock.find(anything())).thenReturn(undefined);

    // default options
    when(RequestExecutorOptionsMock.timeout).thenReturn(undefined);
    when(RequestExecutorOptionsMock.proxyUrl).thenReturn(undefined);
    when(RequestExecutorOptionsMock.headers).thenReturn(undefined);
    when(RequestExecutorOptionsMock.certs).thenReturn(undefined);
    when(RequestExecutorOptionsMock.whitelistMimes).thenReturn(undefined);
    when(RequestExecutorOptionsMock.maxContentLength).thenReturn(undefined);
    when(RequestExecutorOptionsMock.reuseConnection).thenReturn(undefined);

    container
      .register<VirtualScripts>(VirtualScripts, {
        useFactory: () => instance(VirtualScriptsMock)
      })
      .register(RequestExecutorOptions, {
        useFactory: () => instance(RequestExecutorOptionsMock)
      })
      .register(
        RequestExecutor,
        { useClass: HttpRequestExecutor },
        { lifecycle: Lifecycle.Singleton }
      );
  });

  afterEach(() => {
    container.reset();

    reset(VirtualScriptsMock);
    reset(VirtualScriptMock);
    reset(RequestExecutorOptionsMock);
    reset(RequestMock);
  });

  describe('get protocol', () => {
    it('should return HTTP', () => {
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      expect(executor.protocol).to.eq(Protocol.HTTP);
    });
  });

  describe('execute', () => {
    it('should call setHeaders on the provided request if additional headers were configured globally', async () => {
      const testHeaders = { testHeader: 'test-header-value' };
      when(RequestExecutorOptionsMock.headers).thenReturn(testHeaders);

      when(RequestMock.setHeaders(anything())).thenReturn(undefined);
      const request = instance(RequestMock);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(RequestMock.setHeaders(testHeaders)).once();
    });

    it('should not call setHeaders on the provided request if there were no additional headers configured', async () => {
      const request = instance(RequestMock);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(RequestMock.setHeaders(anything())).never();
    });

    it('should transform the request if there is a suitable vm', async () => {
      const requestOptions = { url: 'https://foo.bar', headers: {} };
      const request = new Request(requestOptions);
      when(VirtualScriptMock.exec(anyString(), anything())).thenResolve(
        requestOptions
      );
      const vm = instance(VirtualScriptMock);
      when(VirtualScriptsMock.find('foo.bar')).thenReturn(vm);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(VirtualScriptMock.exec(anyString(), anything())).once();
    });

    it('should call setCerts on the provided request if there were certificates configured globally', async () => {
      when(RequestMock.url).thenReturn('https://foo.bar');
      const request = instance(RequestMock);
      when(RequestExecutorOptionsMock.certs).thenReturn([]);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(RequestMock.setCerts(anything())).once();
    });

    it('should not call setCerts on the provided request if there were no certificates configured', async () => {
      when(RequestMock.url).thenReturn('https://foo.bar');
      const request = instance(RequestMock);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(RequestMock.setCerts(anything())).never();
    });

    it('should perform an external http request', async () => {
      const url = 'https://foo.bar';
      nock(url).get('/').reply(200, {});

      const request = new Request({ url, headers: {} });
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      expect(response.statusCode).to.equal(200);
      expect(response.body).to.be.a('string').and.to.equal('{}');
    });

    it('should handle HTTP errors', async () => {
      const url = 'https://foo.bar';
      nock(url).get('/').reply(500, {});

      const request = new Request({ url, headers: {} });
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      expect(response.statusCode).to.equal(500);
      expect(response.body).to.be.a('string').and.to.equal('{}');
    });

    it('should handle non-HTTP errors', async () => {
      const url = 'https://foo.bar';
      const request = new Request({ url, headers: {} });
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      expect(response.statusCode).to.equal(undefined);
    });
  });
});

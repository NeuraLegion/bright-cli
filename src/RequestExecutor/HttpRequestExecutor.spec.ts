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
  const virtualScriptsMock = mock<VirtualScripts>(DefaultVirtualScripts);
  const virtualScriptMock = mock<VirtualScript>(VirtualScript);
  const requestMock = mock<Request>(Request);

  let requestExecutorOptions: RequestExecutorOptions;

  beforeEach(() => {
    when(virtualScriptsMock.find(anything())).thenReturn(undefined);

    requestExecutorOptions = {};

    container
      .register<VirtualScripts>(VirtualScripts, {
        useFactory: () => instance(virtualScriptsMock)
      })
      .register(RequestExecutorOptions, {
        useValue: requestExecutorOptions
      })
      .register(
        RequestExecutor,
        { useClass: HttpRequestExecutor },
        { lifecycle: Lifecycle.Singleton }
      );
  });

  afterEach(() => {
    container.reset();

    reset(virtualScriptsMock);
    reset(virtualScriptMock);
    reset(requestMock);
  });

  describe('protocol', () => {
    it('should return HTTP', () => {
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      executor.protocol.should.eq(Protocol.HTTP);
    });
  });

  describe('execute', () => {
    it('should call setHeaders on the provided request if additional headers were configured globally', async () => {
      const testHeaders = { testHeader: 'test-header-value' };
      requestExecutorOptions.headers = testHeaders;

      when(requestMock.setHeaders(anything())).thenReturn(undefined);
      const request = instance(requestMock);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(requestMock.setHeaders(testHeaders)).once();
    });

    it('should not call setHeaders on the provided request if there were no additional headers configured', async () => {
      const request = instance(requestMock);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(requestMock.setHeaders(anything())).never();
    });

    it('should transform the request if there is a suitable vm', async () => {
      const requestOptions = { url: 'https://foo.bar', headers: {} };
      const request = new Request(requestOptions);
      when(virtualScriptMock.exec(anyString(), anything())).thenResolve(
        requestOptions
      );
      const vm = instance(virtualScriptMock);
      when(virtualScriptsMock.find('foo.bar')).thenReturn(vm);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(virtualScriptMock.exec(anyString(), anything())).once();
    });

    it('should not transform the request if there is no suitable vm', async () => {
      when(requestMock.url).thenReturn('https://foo.bar');
      when(requestMock.headers).thenReturn({});
      when(requestMock.toJSON()).thenReturn(undefined);
      const request = instance(requestMock);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(requestMock.toJSON()).never();
    });

    it('should call setCerts on the provided request if there were certificates configured globally', async () => {
      when(requestMock.url).thenReturn('https://foo.bar');
      const request = instance(requestMock);
      requestExecutorOptions.certs = [];
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(requestMock.setCerts(anything())).once();
    });

    it('should not call setCerts on the provided request if there were no certificates configured', async () => {
      when(requestMock.url).thenReturn('https://foo.bar');
      const request = instance(requestMock);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(requestMock.setCerts(anything())).never();
    });

    it('should perform an external http request', async () => {
      const url = 'https://foo.bar';
      nock(url).get('/').reply(200, {});

      const request = new Request({ url, headers: {} });
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      response.statusCode.should.equal(200);
      response.body.should.be.a('string').and.to.equal('{}');
    });

    it('should handle HTTP errors', async () => {
      const url = 'https://foo.bar';
      nock(url).get('/').reply(500, {});

      const request = new Request({ url, headers: {} });
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      response.statusCode.should.equal(500);
      response.body.should.be.a('string').and.to.equal('{}');
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

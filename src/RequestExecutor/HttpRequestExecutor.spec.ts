import 'reflect-metadata';
import 'chai/register-should';
import { HttpRequestExecutor } from './HttpRequestExecutor';
import {
  DefaultVirtualScripts,
  VirtualScript,
  VirtualScripts,
  VirtualScriptType
} from '../Scripts';
import { Protocol } from './Protocol';
import { RequestExecutor } from './RequestExecutor';
import { Request, RequestOptions } from './Request';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { expect } from 'chai';
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
import { container, Lifecycle } from 'tsyringe';
import { URL } from 'url';

describe('HttpRequestExecutor', () => {
  const createRequest = (options?: Partial<RequestOptions>) => {
    const requestOptions = { url: 'https://foo.bar', headers: {}, ...options };
    const request = new Request(requestOptions);
    const spiedRequest = spy(request);
    when(spiedRequest.method).thenReturn('GET');

    return { requestOptions, request, spiedRequest };
  };

  const virtualScriptsMock = mock<VirtualScripts>(DefaultVirtualScripts);

  let requestExecutorOptions: RequestExecutorOptions;

  beforeEach(() => {
    requestExecutorOptions = {};

    container
      .register<VirtualScripts>(VirtualScripts, {
        useFactory: () => instance(virtualScriptsMock)
      })
      .register(RequestExecutorOptions, {
        useFactory: () => requestExecutorOptions
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
  });

  describe('protocol', () => {
    it('should return HTTP', () => {
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      executor.protocol.should.eq(Protocol.HTTP);
    });
  });

  describe('execute', () => {
    it('should call setHeaders on the provided request if additional headers were configured globally', async () => {
      const headers = { testHeader: 'test-header-value' };
      requestExecutorOptions = { headers };
      const executor = container.resolve<RequestExecutor>(RequestExecutor);
      const { request, spiedRequest } = createRequest();

      await executor.execute(request);

      verify(spiedRequest.setHeaders(headers)).once();
    });

    it('should not call setHeaders on the provided request if there were no additional headers configured', async () => {
      const executor = container.resolve<RequestExecutor>(RequestExecutor);
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
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(spiedVirtualScript.exec(anyString(), anything())).once();
    });

    it('should not transform the request if there is no suitable vm', async () => {
      const { request, spiedRequest } = createRequest();
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(spiedRequest.toJSON()).never();
    });

    it('should call setCerts on the provided request if there were certificates configured globally', async () => {
      requestExecutorOptions = { certs: [] };
      const executor = container.resolve<RequestExecutor>(RequestExecutor);
      const { request, spiedRequest } = createRequest();

      await executor.execute(request);

      verify(spiedRequest.setCerts(anything())).once();
    });

    it('should not call setCerts on the provided request if there were no certificates configured', async () => {
      const { request, spiedRequest } = createRequest();
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(spiedRequest.setCerts(anything())).never();
    });

    it('should perform an external http request', async () => {
      const { request, requestOptions } = createRequest();
      nock(requestOptions.url).get('/').reply(200, {});
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      response.statusCode.should.equal(200);
      response.body.should.be.a('string').and.to.equal('{}');
    });

    it('should handle HTTP errors', async () => {
      const { request, requestOptions } = createRequest();
      nock(requestOptions.url).get('/').reply(500, {});
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      response.statusCode.should.equal(500);
      response.body.should.be.a('string').and.to.equal('{}');
    });

    it('should handle non-HTTP errors', async () => {
      const { request } = createRequest();
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      expect(response.statusCode).to.equal(undefined);
    });
  });
});

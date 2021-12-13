import 'reflect-metadata';

import { Protocol } from './Protocol';
import { RequestExecutor } from './RequestExecutor';
import { WsRequestExecutor } from './WsRequestExecutor';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { Request } from './Request';
import { anything, instance, mock, reset, verify, when } from 'ts-mockito';
import { container, Lifecycle } from 'tsyringe';
import { expect } from 'chai';
import { Server } from 'ws';

describe('WsRequestExecutor', () => {
  const RequestExecutorOptionsMock = mock<RequestExecutorOptions>();
  const RequestMock = mock<Request>(Request);

  beforeEach(() => {
    // default options
    when(RequestExecutorOptionsMock.timeout).thenReturn(2000);
    when(RequestExecutorOptionsMock.proxyUrl).thenReturn(undefined);
    when(RequestExecutorOptionsMock.certs).thenReturn(undefined);

    when(RequestMock.ca).thenReturn(undefined);
    when(RequestMock.pfx).thenReturn(undefined);
    when(RequestMock.passphrase).thenReturn(undefined);

    container
      .register(RequestExecutorOptions, {
        useFactory: () => instance(RequestExecutorOptionsMock)
      })
      .register(
        RequestExecutor,
        { useClass: WsRequestExecutor },
        { lifecycle: Lifecycle.Singleton }
      );
  });

  afterEach(() => {
    container.reset();

    reset(RequestExecutorOptionsMock);
    reset(RequestMock);
  });

  describe('protocol', () => {
    it('should use WS protocol', () => {
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      expect(executor.protocol).to.equal(Protocol.WS);
    });
  });

  describe('execute', () => {
    let server: Server;
    let wsPort: number;

    beforeEach((done) => {
      server = new Server({ port: 0 });
      server.on('listening', () => {
        const address = server.address();
        if (typeof address === 'string') {
          return done(new Error('Unsupported server address type'));
        }

        wsPort = address.port;

        done();
      });
    });

    afterEach((done) => {
      wsPort = Number.NaN;
      server.close(done);
    });

    it('should call setCerts on the provided request if there were certificates configured globally', async () => {
      when(RequestMock.url).thenReturn('wss://foo.bar');
      when(RequestMock.headers).thenReturn({});
      const request = instance(RequestMock);
      when(RequestExecutorOptionsMock.certs).thenReturn([]);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(RequestMock.setCerts(anything())).once();
    });

    it('should not call setCerts on the provided request if there were no globally configured certificates', async () => {
      when(RequestMock.url).thenReturn('wss://foo.bar');
      when(RequestMock.headers).thenReturn({});
      const request = instance(RequestMock);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(RequestMock.setCerts(anything())).never();
    });

    it('should send request body to a web-socket server', (done) => {
      const url = `ws://localhost:${wsPort}`;
      const headers = {};
      const body = 'test request body';
      const request = new Request({ url, headers, body });

      server.on('connection', async (socket) => {
        socket.on('message', (data) => {
          expect(data).to.be.instanceOf(Buffer);
          expect(data.toString()).to.equal(body);

          socket.send('test reply');

          done();
        });
      });

      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      executor.execute(request);
    });

    it('should fail sending request by timeout', async () => {
      when(RequestExecutorOptionsMock.timeout).thenReturn(1);

      const url = `ws://localhost:${wsPort}`;
      const request = new Request({ url, headers: {} });
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      expect(response.message).to.equal('Waiting frame has timed out');
      expect(response.errorCode).to.equal('ETIMEDOUT');
    });

    it('should not allow setting forbidden headers', (done) => {
      const url = `ws://localhost:${wsPort}`;
      const headers = { 'test-header': 'test-header-value' };
      WsRequestExecutor.FORBIDDEN_HEADERS.forEach(
        (headerName) => (headers[headerName] = 'forbidden-header-value')
      );
      const request = new Request({ url, headers });

      server.on('connection', (socket, req) => {
        WsRequestExecutor.FORBIDDEN_HEADERS.forEach((headerName) => {
          expect(req.headers).to.have.ownProperty(headerName);
          expect(req.headers[headerName]).to.not.equal(
            'forbidden-header-value'
          );
        });

        expect(req.headers).to.have.ownProperty('test-header');
        expect(req.headers['test-header']).to.equal('test-header-value');

        socket.on('message', () => {
          socket.send('test reply');
        });

        done();
      });

      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      executor.execute(request);
    });

    it('should get the response from server', async () => {
      const url = `ws://localhost:${wsPort}`;
      const request = new Request({ url, headers: {} });

      server.on('connection', async (socket) => {
        socket.on('message', () => {
          socket.send('test reply', { binary: false, compress: false });
        });
      });

      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      expect(response.body).to.equal('test reply');
    });
  });
});

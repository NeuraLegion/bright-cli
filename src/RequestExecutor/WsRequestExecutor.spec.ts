import 'reflect-metadata';
import { Protocol } from './Protocol';
import { RequestExecutor } from './RequestExecutor';
import { WsRequestExecutor } from './WsRequestExecutor';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { Request } from './Request';
import { anything, instance, mock, reset, verify, when } from 'ts-mockito';
import { container, Lifecycle } from 'tsyringe';
import { should } from 'chai';
import { Server } from 'ws';

should();

describe('WsRequestExecutor', () => {
  const requestMock = mock<Request>(Request);

  let requestExecutorOptions: RequestExecutorOptions;

  beforeEach(() => {
    // default options
    requestExecutorOptions = { timeout: 2000 };

    when(requestMock.ca).thenReturn(undefined);
    when(requestMock.pfx).thenReturn(undefined);
    when(requestMock.passphrase).thenReturn(undefined);

    container
      .register(RequestExecutorOptions, {
        useValue: requestExecutorOptions
      })
      .register(
        RequestExecutor,
        { useClass: WsRequestExecutor },
        { lifecycle: Lifecycle.Singleton }
      );
  });

  afterEach(() => {
    container.reset();

    reset(requestMock);
  });

  describe('protocol', () => {
    it('should use WS protocol', () => {
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      executor.protocol.should.equal(Protocol.WS);
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
      when(requestMock.url).thenReturn('wss://foo.bar');
      when(requestMock.headers).thenReturn({});
      const request = instance(requestMock);
      requestExecutorOptions.certs = [];
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(requestMock.setCerts(anything())).once();
    });

    it('should not call setCerts on the provided request if there were no globally configured certificates', async () => {
      when(requestMock.url).thenReturn('wss://foo.bar');
      when(requestMock.headers).thenReturn({});
      const request = instance(requestMock);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(requestMock.setCerts(anything())).never();
    });

    it('should send request body to a web-socket server', (done) => {
      const url = `ws://localhost:${wsPort}`;
      const headers = {};
      const body = 'test request body';
      const request = new Request({ url, headers, body });

      server.on('connection', async (socket) => {
        socket.on('message', (data) => {
          data.should.be.instanceOf(Buffer);
          data.toString().should.equal(body);

          socket.send('test reply');

          done();
        });
      });

      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      executor.execute(request);
    });

    it('should fail sending request by timeout', async () => {
      requestExecutorOptions.timeout = 1;

      const url = `ws://localhost:${wsPort}`;
      const request = new Request({ url, headers: {} });
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      response.message.should.equal('Waiting frame has timed out');
      response.errorCode.should.equal('ETIMEDOUT');
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
          req.headers.should.have.ownProperty(headerName);
          req.headers[headerName].should.not.equal('forbidden-header-value');
        });

        req.headers.should.have.ownProperty('test-header');
        req.headers['test-header'].should.equal('test-header-value');

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

      response.body.should.equal('test reply');
    });
  });
});

import 'reflect-metadata';
import 'chai/register-should';
import { Protocol } from './Protocol';
import { RequestExecutor } from './RequestExecutor';
import { WsRequestExecutor } from './WsRequestExecutor';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { Request } from './Request';
import { anything, spy, verify } from 'ts-mockito';
import { container, Lifecycle } from 'tsyringe';
import { Server } from 'ws';
import { once } from 'events';

describe('WsRequestExecutor', () => {
  let requestExecutorOptions: RequestExecutorOptions;

  beforeEach(() => {
    requestExecutorOptions = { timeout: 2000 };

    container
      .register(RequestExecutorOptions, {
        useFactory: () => requestExecutorOptions
      })
      .register(
        RequestExecutor,
        { useClass: WsRequestExecutor },
        { lifecycle: Lifecycle.Singleton }
      );
  });

  afterEach(() => {
    container.reset();
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

    beforeEach(async () => {
      server = new Server({ port: 0 });
      await once(server, 'listening');

      const address = server.address();
      if (typeof address === 'string') {
        throw new Error('Unsupported server address type');
      }

      wsPort = address.port;
    });

    afterEach((done) => {
      wsPort = Number.NaN;
      server.close(done);
    });

    it('should call setCerts on the provided request if there were certificates configured globally', async () => {
      const request = new Request({ url: 'wss://foo.bar', headers: {} });
      const spiedRequest = spy(request);
      requestExecutorOptions = { timeout: 2000, certs: [] };
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(spiedRequest.setCerts(anything())).once();
    });

    it('should not call setCerts on the provided request if there were no globally configured certificates', async () => {
      const request = new Request({ url: 'wss://foo.bar', headers: {} });
      const spiedRequest = spy(request);
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      await executor.execute(request);

      verify(spiedRequest.setCerts(anything())).never();
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
      requestExecutorOptions = { timeout: 1 };

      const url = `ws://localhost:${wsPort}`;
      const request = new Request({ url, headers: {} });
      const executor = container.resolve<RequestExecutor>(RequestExecutor);

      const response = await executor.execute(request);

      response.should.deep.equal({
        body: undefined,
        errorCode: 'ETIMEDOUT',
        headers: undefined,
        message: 'Waiting frame has timed out',
        protocol: 'ws',
        statusCode: undefined
      });
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

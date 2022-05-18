import 'reflect-metadata';
import { Protocol } from './Protocol';
import { WsRequestExecutor } from './WsRequestExecutor';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { Request } from './Request';
import { anything, reset, spy, verify, when } from 'ts-mockito';
import { Server } from 'ws';
import { once } from 'events';

describe('WsRequestExecutor', () => {
  const executorOptions: RequestExecutorOptions = { timeout: 2000 };
  const spiedExecutorOptions = spy<RequestExecutorOptions>(executorOptions);

  // TODO: discuss renaming such kind of variables to `SUT` or `UUT`
  let executor!: WsRequestExecutor;

  beforeEach(() => {
    // ADHOC: ts-mockito resets object's property descriptor as well
    Object.assign(executorOptions, { timeout: 2000 });
    executor = new WsRequestExecutor(executorOptions);
  });

  afterEach(() => reset<RequestExecutorOptions>(spiedExecutorOptions));

  describe('protocol', () => {
    it('should use WS protocol', () => {
      const protocol = executor.protocol;
      expect(protocol).toBe(Protocol.WS);
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
      when(spiedExecutorOptions.certs).thenReturn([]);
      await executor.execute(request);

      verify(spiedRequest.setCerts(anything())).once();
    });

    it('should not call setCerts on the provided request if there were no globally configured certificates', async () => {
      const request = new Request({ url: 'wss://foo.bar', headers: {} });
      const spiedRequest = spy(request);

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
          expect(data).toBeInstanceOf(Buffer);
          expect(data.toString()).toBe(body);

          socket.send('test reply');

          done();
        });
      });

      executor.execute(request);
    });

    it('should fail sending request by timeout', async () => {
      when(spiedExecutorOptions.timeout).thenReturn(1);

      const url = `ws://localhost:${wsPort}`;
      const request = new Request({ url, headers: {} });

      const response = await executor.execute(request);

      expect(response).toEqual({
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
        const test = req.headers;
        WsRequestExecutor.FORBIDDEN_HEADERS.forEach((headerName) => {
          expect(test).toMatchObject({
            [headerName]: expect.not.stringContaining('forbidden-header-value')
          });
        });

        expect(test).toMatchObject({
          'test-header': 'test-header-value'
        });

        socket.on('message', () => {
          socket.send('test reply');
        });

        done();
      });

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

      const response = await executor.execute(request);

      expect(response.body).toBe('test reply');
    });
  });
});

import 'reflect-metadata';
import { Protocol } from './Protocol';
import { WsRequestExecutor } from './WsRequestExecutor';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
import { Cert, Request } from './Request';
import { ProxyFactory } from '../Utils';
import { anything, instance, mock, reset, spy, verify, when } from 'ts-mockito';
import { Server } from 'ws';
import { once } from 'node:events';

describe('WsRequestExecutor', () => {
  const executorOptions: RequestExecutorOptions = { timeout: 2000 };
  const spiedExecutorOptions = spy<RequestExecutorOptions>(executorOptions);
  const certificatesCacheMock = mock<CertificatesCache>();
  const certificatesResolverMock = mock<CertificatesResolver>();
  const proxyFactoryMock = mock<ProxyFactory>();

  let executor!: WsRequestExecutor;

  beforeEach(() => {
    // ADHOC: ts-mockito resets object's property descriptor as well
    Object.assign(executorOptions, { timeout: 2000 });
    executor = new WsRequestExecutor(
      instance(proxyFactoryMock),
      executorOptions,
      certificatesCacheMock,
      instance(certificatesResolverMock)
    );
  });

  afterEach(() =>
    reset<
      | RequestExecutorOptions
      | ProxyFactory
      | CertificatesCache
      | CertificatesResolver
    >(
      proxyFactoryMock,
      spiedExecutorOptions,
      certificatesCacheMock,
      certificatesResolverMock
    )
  );

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

    it('should call loadCerts on the provided request if there were certificates configured globally', async () => {
      const request = new Request({
        protocol: Protocol.WS,
        url: 'wss://foo.bar',
        headers: {}
      });
      const spiedRequest = spy(request);
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
    });

    it('should not call loadCerts on the provided request if there were no globally configured certificates', async () => {
      const request = new Request({
        protocol: Protocol.WS,
        url: 'wss://foo.bar',
        headers: {}
      });
      const spiedRequest = spy(request);

      await executor.execute(request);

      verify(spiedRequest.loadCert(anything())).never();
    });

    it('should send request body to a web-socket server', (done) => {
      const url = `ws://localhost:${wsPort}`;
      const headers = {};
      const body = 'test request body';
      const request = new Request({
        url,
        headers,
        body,
        protocol: Protocol.WS
      });

      server.on('connection', (socket) => {
        socket.on('message', (data) => {
          expect(data).toBeInstanceOf(Buffer);
          expect(data.toString()).toBe(body);

          socket.send('test reply');

          done();
        });
      });

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      executor.execute(request);
    });

    it('should fail sending request by timeout', async () => {
      when(spiedExecutorOptions.timeout).thenReturn(100);

      const url = `ws://localhost:${wsPort}`;
      const request = new Request({ url, headers: {}, protocol: Protocol.WS });

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
      const request = new Request({ url, headers, protocol: Protocol.WS });

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

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      executor.execute(request);
    });

    it('should get the response from server', async () => {
      when(certificatesCacheMock.get(anything())).thenReturn(undefined);
      const url = `ws://localhost:${wsPort}`;
      const request = new Request({ url, headers: {}, protocol: Protocol.WS });

      server.on('connection', (socket) => {
        socket.on('message', () => {
          socket.send('test reply', { binary: false, compress: false });
        });
      });

      const response = await executor.execute(request);

      expect(response.body).toBe('test reply');
    });
  });
});

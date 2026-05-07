import 'reflect-metadata';
import { HttpRequestExecutor } from './HttpRequestExecutor';
import { VirtualScripts } from '../Scripts';
import { Protocol } from './Protocol';
import { Request } from './Request';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
import { ProxyFactory } from '../Utils';
import { instance, mock } from 'ts-mockito';

function buildExecutor(curlAvailable: boolean): HttpRequestExecutor {
  const virtualScriptsMock = mock<VirtualScripts>();
  const proxyFactoryMock = mock<ProxyFactory>();
  const certificatesCacheMock = mock<CertificatesCache>();
  const certificatesResolverMock = mock<CertificatesResolver>();
  const options = {} as RequestExecutorOptions;

  jest.resetModules();

  if (curlAvailable) {
    jest.mock('node-libcurl', () => ({
      Curl: jest.fn(),
      CurlFeature: { NoDataParsing: 0 }
    }));
  } else {
    jest.mock('node-libcurl', () => {
      throw new Error('Module not found');
    });
  }

  return new HttpRequestExecutor(
    instance(virtualScriptsMock),
    instance(proxyFactoryMock),
    options,
    certificatesCacheMock,
    instance(certificatesResolverMock)
  );
}

describe('HttpRequestExecutor', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  describe('protocol', () => {
    it('should return HTTP', () => {
      // Use the real require to avoid resetting modules for a trivial check.
      const virtualScriptsMock = mock<VirtualScripts>();
      const proxyFactoryMock = mock<ProxyFactory>();
      const certificatesCacheMock = mock<CertificatesCache>();
      const certificatesResolverMock = mock<CertificatesResolver>();
      const executor = new HttpRequestExecutor(
        instance(virtualScriptsMock),
        instance(proxyFactoryMock),
        {} as RequestExecutorOptions,
        certificatesCacheMock,
        instance(certificatesResolverMock)
      );
      expect(executor.protocol).toBe(Protocol.HTTP);
    });
  });

  describe('when node-libcurl is available', () => {
    it('should delegate to HttpCurlRequestExecutor', () => {
      const executor = buildExecutor(true);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      expect(executor['delegate'].constructor.name).toBe(
        'HttpCurlRequestExecutor'
      );
    });

    it('should forward execute() calls to the curl delegate', async () => {
      const executor = buildExecutor(true);
      const expected = { statusCode: 200, body: 'ok' };
      // eslint-disable-next-line @typescript-eslint/dot-notation
      jest
        .spyOn(executor['delegate'], 'execute')
        .mockResolvedValue(expected as any);

      const result = await executor.execute({} as Request);

      expect(result).toBe(expected);
    });
  });

  describe('when node-libcurl is unavailable', () => {
    it('should delegate to HttpLegacyRequestExecutor', () => {
      const executor = buildExecutor(false);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      expect(executor['delegate'].constructor.name).toBe(
        'HttpLegacyRequestExecutor'
      );
    });

    it('should forward execute() calls to the legacy delegate', async () => {
      const executor = buildExecutor(false);
      const expected = { statusCode: 200, body: 'ok' };
      // eslint-disable-next-line @typescript-eslint/dot-notation
      jest
        .spyOn(executor['delegate'], 'execute')
        .mockResolvedValue(expected as any);

      const result = await executor.execute({} as Request);

      expect(result).toBe(expected);
    });
  });
});

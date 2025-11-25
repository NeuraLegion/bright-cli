import 'reflect-metadata';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
import { Request, RequestOptions, Cert } from './Request';
import { Protocol } from './Protocol';
import { DefaultCertificatesResolver } from './DefaultCertificatesResolver';
import { instance, mock, spy, when, reset } from 'ts-mockito';

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

describe('DefaultCertificatesResolver', () => {
  const certificatesCacheMock = mock<CertificatesCache>();
  let certificatesResolver!: CertificatesResolver;

  beforeEach(() => {
    certificatesResolver = new DefaultCertificatesResolver(
      instance(certificatesCacheMock)
    );
  });
  afterEach(() => {
    reset<CertificatesCache>(certificatesCacheMock);
  });

  describe('resolve certificates', () => {
    it.each([
      'https://example.com',
      'https://local.example.com',
      'https://some.example.com'
    ])('should return certificate matching by hostname pattern', (url) => {
      // arrange
      const cert: Cert = {
        path: '/tmp/cert',
        hostname: '*example.com',
        port: '443'
      };
      const { request } = createRequest({
        url
      });
      when(certificatesCacheMock.get(request)).thenReturn(undefined);

      // act
      const actual = certificatesResolver.resolve(request, [cert]);

      // assert
      expect(actual).toEqual([cert]);
    });

    it.each([
      'https://example.com',
      'https://local.example.com',
      'https://some.example.com'
    ])('should not return certificate not matching by port', (url) => {
      // arrange
      const cert: Cert = {
        path: '/tmp/cert',
        hostname: '*example.com',
        port: '4443'
      };
      const { request } = createRequest({
        url
      });
      when(certificatesCacheMock.get(request)).thenReturn(undefined);

      // act
      const actual = certificatesResolver.resolve(request, [cert]);

      // assert
      expect(actual).toEqual([]);
    });
  });
});

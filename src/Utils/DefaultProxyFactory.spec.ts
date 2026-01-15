import { DefaultProxyFactory } from './DefaultProxyFactory';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

describe('DefaultProxyFactory', () => {
  let defaultProxyFactory: DefaultProxyFactory;

  beforeEach(() => {
    defaultProxyFactory = new DefaultProxyFactory();
  });

  describe('createProxy', () => {
    it('should create http and https proxy agents for http protocol', () => {
      // arrange
      const proxyOptions = {
        proxyUrl: 'http://proxy.example.com',
        rejectUnauthorized: false
      };

      // act
      const result = defaultProxyFactory.createProxy(proxyOptions);

      // assert
      expect(result.httpAgent).toBeInstanceOf(HttpProxyAgent);
      expect(result.httpsAgent).toBeInstanceOf(HttpsProxyAgent);
    });

    it('should create socks proxy agents for socks protocol', () => {
      // arrange
      const proxyOptions = {
        proxyUrl: 'socks://proxy.example.com',
        rejectUnauthorized: false
      };

      // act
      const result = defaultProxyFactory.createProxy(proxyOptions);

      // assert
      expect(result.httpAgent).toBeInstanceOf(SocksProxyAgent);
      expect(result.httpsAgent).toBeInstanceOf(SocksProxyAgent);
    });

    it('should throw error for unsupported protocol', () => {
      // arrange
      const proxyOptions = {
        proxyUrl: 'unsupported://proxy.example.com',
        rejectUnauthorized: false
      };

      // act & assert
      expect(() => defaultProxyFactory.createProxy(proxyOptions)).toThrow(
        'Unsupported proxy protocol'
      );
    });
  });

  describe('createProxyForClient', () => {
    it('should return http agent for http protocol', () => {
      // arrange
      const targetProxyOptions = {
        targetUrl: 'http://target.example.com',
        proxyUrl: 'http://proxy.example.com',
        rejectUnauthorized: false
      };

      // act
      const result =
        defaultProxyFactory.createProxyForClient(targetProxyOptions);

      // assert
      expect(result).toBeInstanceOf(HttpProxyAgent);
    });

    it('should return https agent for https protocol', () => {
      // arrange
      const targetProxyOptions = {
        targetUrl: 'https://target.example.com',
        proxyUrl: 'http://proxy.example.com',
        rejectUnauthorized: false
      };

      // act
      const result =
        defaultProxyFactory.createProxyForClient(targetProxyOptions);

      // assert
      expect(result).toBeInstanceOf(HttpsProxyAgent);
    });

    it('should throw error for unsupported protocol', () => {
      // arrange
      const targetProxyOptions = {
        targetUrl: 'unsupported://target.example.com',
        proxyUrl: 'http://proxy.example.com',
        rejectUnauthorized: false
      };

      // act & assert
      expect(() =>
        defaultProxyFactory.createProxyForClient(targetProxyOptions)
      ).toThrow('Proxy not supported for protocol');
    });
  });
});

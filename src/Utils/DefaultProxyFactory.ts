import { ProxyFactory, ProxyOptions, TargetProxyOptions } from './ProxyFactory';
import { AmqpProxy } from './AmqpProxy';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { URL } from 'url';
import https from 'https';
import http from 'http';

export class DefaultProxyFactory implements ProxyFactory {
  public createProxy({ proxyUrl, rejectUnauthorized = false }: ProxyOptions) {
    let protocol: string;
    try {
      ({ protocol } = new URL(proxyUrl));
    } catch (error) {
      throw new Error(
        `Invalid Proxy URL: '${proxyUrl}'. Please provide a valid URL.`
      );
    }

    switch (protocol) {
      case 'http:':
      case 'https:':
        return this.createHttpProxy(proxyUrl, rejectUnauthorized);
      case 'socks:':
      case 'socks4:':
      case 'socks4a:':
      case 'socks5:':
      case 'socks5h:':
        return this.createSocksProxy(proxyUrl);
      default:
        throw new Error(
          `Unsupported proxy protocol: '${protocol.replace(
            ':',
            ''
          )}'. Please use a supported protocol (HTTP(S), SOCKS4, or SOCKS5).`
        );
    }
  }

  public createProxyForClient({
    targetUrl,
    ...options
  }: TargetProxyOptions): https.Agent | http.Agent {
    const proxies = this.createProxy(options);
    let protocol: string;
    try {
      ({ protocol } = new URL(targetUrl));
    } catch (error) {
      throw new Error(
        `Invalid Target URL: '${targetUrl}'. Please contact support at support@brightsec.com`
      );
    }

    switch (protocol) {
      case 'http:':
      case 'ws:':
        return proxies.http;
      case 'https:':
      case 'wss:':
        return proxies.https;
      default:
        throw new Error(
          `Proxy not supported for protocol '${protocol}'. Please contact support at support@brightsec.com`
        );
    }
  }

  public createAmqpProxy(url: string): AmqpProxy {
    return new AmqpProxy(url);
  }

  private createHttpProxy(proxyUrl: string, rejectUnauthorized?: boolean) {
    return {
      https: new HttpsProxyAgent(proxyUrl, {
        rejectUnauthorized
      }),
      http: new HttpProxyAgent(proxyUrl)
    };
  }

  private createSocksProxy(proxyUrl: string) {
    const common = new SocksProxyAgent(proxyUrl);

    return { http: common, https: common };
  }
}

import { AmqpProxy } from './AmqpProxy';
import https from 'https';
import http from 'http';

export interface ProxyOptions {
  proxyUrl: string;
  rejectUnauthorized?: boolean;
}

export interface TargetProxyOptions extends ProxyOptions {
  targetUrl: string;
}

export interface ProxyFactory {
  createProxy(options: ProxyOptions): {
    httpsAgent: https.Agent;
    httpAgent: http.Agent;
  };

  createProxyForClient(options: TargetProxyOptions): https.Agent | http.Agent;

  createAmqpProxy(url: string): AmqpProxy;
}

export const ProxyFactory: unique symbol = Symbol('ProxyFactory');

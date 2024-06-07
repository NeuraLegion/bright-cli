import https from 'node:https';
import http from 'node:http';

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
}

export const ProxyFactory: unique symbol = Symbol('ProxyFactory');

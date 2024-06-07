import {
  HttpsProxyAgent,
  type HttpsProxyAgentOptions
} from 'https-proxy-agent';
import { type URL } from 'node:url';
import type http from 'node:http';
import type net from 'node:net';

const kTlsUpgradeOptions = Symbol('tlsUpgradeOptions');

// ADHOC: This is a workaround for this issue: https://github.com/TooTallNate/node-https-proxy-agent/issues/89
export class PatchedHttpsProxyAgent<
  T extends string
> extends HttpsProxyAgent<T> {
  private readonly [kTlsUpgradeOptions]?: HttpsProxyAgentOptions<T>;

  constructor(proxy: T | URL, opts?: HttpsProxyAgentOptions<T>) {
    super(proxy, opts);
    this[kTlsUpgradeOptions] = opts;
  }

  public override connect(
    req: http.ClientRequest,
    opts: Parameters<HttpsProxyAgent<T>['connect']>[1]
  ): Promise<net.Socket> {
    return super.connect(req, { ...this[kTlsUpgradeOptions], ...opts });
  }
}

import { SocksClient, SocksProxy } from 'socks';
import { Socket } from 'node:net';
import { lookup } from 'node:dns/promises';

export class AmqpProxy {
  private _options: SocksProxy;

  get options(): Readonly<SocksProxy> {
    return this._options;
  }

  private _lookup: boolean = false;

  get lookup(): boolean {
    return this._lookup;
  }

  constructor(url: string) {
    const {
      hostname,
      protocol,
      username,
      password,
      port = 1080
    } = new URL(url);

    const type: 4 | 5 = this.discovery(protocol);

    this.setOptions(type, username, password, port, hostname);
  }

  public async open(url: string): Promise<Socket> {
    let { hostname, port }: { hostname: string; port: string | number } =
      new URL(url);

    if (this._lookup) {
      ({ address: hostname } = await lookup(hostname));
    }

    if (typeof port == 'string') {
      port = parseInt(port, 10);
    } else {
      port = url.startsWith('https:') ? 443 : 80;
    }

    const socks = await SocksClient.createConnection({
      proxy: this._options,
      command: 'connect',
      destination: {
        port,
        host: hostname
      }
    });

    return socks.socket;
  }

  private setOptions(
    type: 4 | 5,
    userId: string,
    password: string,
    port: number | string,
    host: string
  ): void {
    const options: SocksProxy = {
      host,
      type,
      userId,
      password,
      port: +port
    };

    if (userId) {
      Object.defineProperty(options, 'userId', {
        value: userId,
        enumerable: false
      });
    }
    if (password) {
      Object.defineProperty(options, 'password', {
        value: password,
        enumerable: false
      });
    }

    this._options = options;
  }

  private discovery(protocol: string): 4 | 5 {
    if (protocol === 'socks4:') {
      this._lookup = true;

      return 4;
    } else if (protocol === 'socks4a:') {
      return 4;
    } else if (protocol === 'socks5:') {
      this._lookup = true;

      return 5;
    } else if (protocol === 'socks:' || protocol === 'socks5h:') {
      return 5;
    } else {
      throw new TypeError(
        `A "socks" protocol must be specified! Got: ${protocol}`
      );
    }
  }
}

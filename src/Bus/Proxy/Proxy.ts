import { SocksClient, SocksProxy } from 'socks';
import { parse } from 'url';
import { Socket } from 'net';
import { promisify } from 'util';
import dns from 'dns';

const lookup = promisify(dns.lookup);

export class Proxy {
  private _options: SocksProxy;

  get options(): Readonly<SocksProxy> {
    return this._options;
  }

  private _lookup: boolean = false;

  get lookup(): boolean {
    return this._lookup;
  }

  constructor(url: string) {
    const { port = 1080, hostname, host, protocol, auth } = parse(url);

    let userId: string | undefined;
    let password: string | undefined;

    if (auth) {
      // eslint-disable-next-line @typescript-eslint/typedef
      [userId, password] = auth.split(':');
    }

    const type: 4 | 5 = this.discovery(protocol);

    this.setOptions(type, userId, password, port, hostname || host);
  }

  public async open(url: string): Promise<Socket> {
    const { host, hostname, port } = parse(url);

    let address;

    if (this._lookup) {
      ({ address } = await lookup(hostname || host));
    }

    const socks = await SocksClient.createConnection({
      proxy: this._options,
      command: 'connect',
      destination: {
        port: +(port ?? 80),
        host: address
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
      Object.defineProperty(this._options, 'userId', {
        value: userId,
        enumerable: false
      });
    }
    if (password) {
      Object.defineProperty(this._options, 'password', {
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

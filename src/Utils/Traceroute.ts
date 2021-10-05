import * as raw from 'raw-socket';
import * as dgram from 'dgram';
import { promises as dns } from 'dns';
import { EventEmitter } from 'events';

export { Protocol } from 'raw-socket';

type Options = {
  amountProbes: number;
  maximumHops: number;
  timeoutInMillis: number;
  reverseLookup: boolean;
  protocol: number;
  outStream: typeof process.stdout;
};

const defaultOptions: Options = {
  amountProbes: 3,
  maximumHops: 64,
  timeoutInMillis: 3000,
  reverseLookup: true,
  protocol: raw.Protocol.UDP,
  outStream: process.stdout
};

export class Traceroute extends EventEmitter {
  private readonly icmpSocket = raw.createSocket({
    protocol: raw.Protocol.ICMP
  });
  private readonly options: Options;
  private port = 33433;
  private ttl = 1;
  private startTime?: [number, number];
  private probes = 0;
  private timeout?: NodeJS.Timeout;
  private previousIP?: string;
  private udpSocket?: dgram.Socket;

  constructor(
    private readonly destinationIp: string,
    userOptions: Partial<Options> = {}
  ) {
    super();
    this.options = { ...defaultOptions, ...userOptions };

    this.icmpSocket.on('message', async (buffer: Buffer, ip: string) => {
      const port = this.udpSocket
        ? buffer.readUInt16BE(50)
        : buffer.readUInt16BE(buffer.length - 2);
      if (port === this.port) {
        const hostName = await this.getHostName(ip);
        this.handleReply(ip, hostName);
      }
    });
  }

  public start(): void {
    if (this.options.protocol === raw.Protocol.UDP) {
      this.udpSocket = dgram.createSocket('udp4');
      this.udpSocket.bind(() => this.sendPacket());
    } else {
      setImmediate(this.sendPacket.bind(this));
    }
  }

  public close(): void {
    if (this.udpSocket) {
      this.udpSocket.close();
    }
    this.icmpSocket.close();
  }

  private async getHostName(ip: string): Promise<string | undefined> {
    if (!this.options.reverseLookup) {
      return;
    }

    const resolver = new dns.Resolver();
    try {
      return (await resolver.reverse(ip))[0];
    } catch (_e) {
      return;
    }
  }

  private sendPacket(): void {
    this.probes++;

    if (this.probes > this.options.amountProbes) {
      this.probes = 1;
      this.ttl++;
    }

    const beforeSend = () =>
      this.icmpSocket.setOption(
        raw.SocketLevel.IPPROTO_IP,
        raw.SocketOption.IP_TTL,
        this.ttl
      );
    const afterSend = (error: Error | null, _bytes: number) => {
      if (error) {
        throw error;
      }
      this.timeout = setTimeout(
        this.handleReply.bind(this),
        this.options.timeoutInMillis
      );
    };

    const buffer = this.createPingRequest(0, 0, ++this.port);

    if (this.udpSocket) {
      this.udpSocket.setTTL(this.ttl);
      this.udpSocket.send(
        buffer,
        0,
        buffer.length,
        this.port,
        this.destinationIp,
        afterSend.bind(this)
      );
    } else {
      this.icmpSocket.send(
        buffer,
        0,
        buffer.length,
        this.destinationIp,
        beforeSend.bind(this),
        afterSend.bind(this)
      );
    }
  }

  private handleReply(ip?: string, symbolicAddress?: string) {
    this.clearTimeout();

    if (ip) {
      const elapsedTime = `${(
        process.hrtime(this.startTime)[1] / 1000000
      ).toFixed(3)} ms`;

      if (ip === this.previousIP) {
        process.stdout.write(`  ${elapsedTime}`);
      } else if (this.probes === 1) {
        process.stdout.write(
          `\n ${this.ttl}  ${
            symbolicAddress ? symbolicAddress : ip
          } (${ip}) ${elapsedTime}`
        );
      } else {
        process.stdout.write(
          `\n    ${
            symbolicAddress ? symbolicAddress : ip
          } (${ip}) ${elapsedTime}`
        );
      }
    } else {
      process.stdout.write(this.probes === 1 ? `\n ${this.ttl}  * ` : `* `);
    }

    if (
      (ip === this.destinationIp && this.probes === 3) ||
      this.ttl >= this.options.maximumHops
    ) {
      process.stdout.write('\n');
      this.close();
      this.emit('done', { reached: this.ttl < this.options.maximumHops });

      return;
    }

    this.previousIP = ip;

    setImmediate(this.sendPacket.bind(this));
  }

  private createPingRequest(
    type: number,
    identifier: number,
    sequence: number,
    packetSize = 0
  ): Buffer {
    const header = [
      type || 0x08,
      0x00,
      0x00,
      0x00,
      this.secondByte(identifier),
      this.firstByte(identifier),
      this.secondByte(sequence),
      this.firstByte(sequence)
    ];
    for (let i = 0; i <= packetSize; i++) {
      header.push(0xff);
    }
    const buffer = Buffer.from(header);
    raw.writeChecksum(buffer, 2, raw.createChecksum(buffer));

    return buffer;
  }

  private firstByte(value: number): number {
    // eslint-disable-next-line no-bitwise
    return value & 0xff;
  }

  private secondByte(value: number): number {
    // eslint-disable-next-line no-bitwise
    return (value & 0xff00) >> 8;
  }

  private clearTimeout(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }
}

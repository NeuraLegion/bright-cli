/* eslint-disable @typescript-eslint/naming-convention */
declare module 'raw-socket' {
  import { EventEmitter } from 'events';

  export interface Options {
    bufferSize?: number;
    protocol?: number;
    addressFamily?: number;
  }

  export interface Socket extends EventEmitter {
    new (options?: Options): this;

    setOption(
      level: number,
      option: number,
      value: number,
      length?: number
    ): void;
    getOption(
      level: number,
      option: number,
      value: number,
      length?: number
    ): number;
    send(
      buffer: Buffer,
      offset: number,
      length: number,
      address: string,
      beforeCallback?: () => void,
      afterCallback?: (error: Error | null, bytes: number) => void
    ): this;
    send(
      buffer: Buffer,
      offset: number,
      length: number,
      address: string,
      afterCallback?: (error: Error | null, bytes: number) => void
    ): this;
    recv(
      buffer: Buffer,
      callback?: (buffer: Buffer, bytes: number, source: strung) => void
    ): this;
    pause(recvPaused: boolean, sendPaused: boolean): this;
    close(): this;
  }

  export function createSocket(options?: Options): Socket;
  export function writeChecksum(
    buffer: Buffer,
    offset: number,
    checksum: number
  ): Buffer;
  export function createChecksum(...args: Buffer[]): number;

  export interface TProtocol {
    ICMP: number;
    TCP: number;
    UDP: number;
    ICMPv6: number;
  }
  export const Protocol: TProtocol;

  export interface TSocketLevel {
    IPPROTO_IP: number;
    IPPROTO_IPV6: number;
    SOL_SOCKET: number;
  }
  export const SocketLevel: TSocketLevel;

  export interface TSocketOption {
    SO_BROADCAST: number;
    SO_RCVBUF: number;
    SO_RCVTIMEO: number;
    SO_SNDBUF: number;
    SO_SNDTIMEO: number;
    IP_HDRINCL: number;
    IP_OPTIONS: number;
    IP_TOS: number;
    IP_TTL: number;
    IPV6_TTL: number;
    IPV6_UNICAST_HOPS: number;
    IPV6_V6ONLY: number;
  }
  export const SocketOption: TSocketOption;
}

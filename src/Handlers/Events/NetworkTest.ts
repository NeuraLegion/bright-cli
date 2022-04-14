import { Event } from '../../Bus';

export enum NetworkTestType {
  PING = 'ping',
  TRACEROUTE = 'traceroute'
}

export interface TracerouteTestConfig {
  readonly type: NetworkTestType.TRACEROUTE;
  readonly url: string;
}

export interface PingTestConfig {
  readonly type: NetworkTestType.PING;
  readonly urls: string[];
}

export type NetworkTestConfig = PingTestConfig | TracerouteTestConfig;
export class NetworkTest implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly config: NetworkTestConfig
  ) {}
}

import { Event } from '../../Bus';

export enum NetworkTestType {
  PING = 'ping',
  TRACEROUTE = 'traceroute'
}

export class NetworkTest implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly type: NetworkTestType,
    public readonly input: string | readonly string[]
  ) {}
}

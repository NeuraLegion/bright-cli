import { Event } from '../../Bus';

export class NetworkTest implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly urls: string[]
  ) {}
}

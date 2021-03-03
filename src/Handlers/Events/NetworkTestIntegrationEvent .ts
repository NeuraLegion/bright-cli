import { Event } from '../../Bus';

export class NetworkTestIntegrationEvent implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly urls: string[]
  ) {}
}

import { Event } from '../../Bus';

export class IntegrationConnected implements Event {
  constructor(
    public readonly accessKey: string,
    public readonly connectivity: 'connected' | 'disconnected'
  ) {}
}

import { Event } from '../../Bus/Event';

export class IntegrationConnected implements Event {
  constructor(
    public readonly accessKey: string,
    public readonly connectivity: 'connected' | 'disconnected'
  ) {}
}

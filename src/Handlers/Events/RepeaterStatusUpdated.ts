import { Event } from '../../Bus/Event';

export class RepeaterStatusUpdated implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly status: 'connected' | 'disconnected'
  ) {}
}

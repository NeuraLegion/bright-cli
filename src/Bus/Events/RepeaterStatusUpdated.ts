import { Event } from '../Event';

export class RepeaterStatusUpdated implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly status: 'connected' | 'disconnected'
  ) {}
}

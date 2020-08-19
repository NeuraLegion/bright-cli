import { Event } from '../Event';

export class AgentStatusUpdated implements Event {
  constructor(
    public readonly agentId: string,
    public readonly status: 'connected' | 'disconnected'
  ) {}
}

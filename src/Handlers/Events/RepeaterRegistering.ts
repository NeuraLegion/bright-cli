import { Event } from '../../Bus';

interface RepeaterRuntime {
  readonly transport?: 'rabbitmq' | 'ws';
  readonly ci?: string;
  readonly arch?: string;
  readonly os?: string;
  readonly docker?: boolean;
  readonly distribution?: string;
  readonly nodeVersion?: string;
}

export class RepeaterRegistering implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly version: string,
    public readonly localScriptsUsed: boolean,
    public readonly runtime?: RepeaterRuntime
  ) {}
}

import { Event } from '../Event';

export class ExecuteScript implements Event {
  constructor(
    public readonly method: string,
    public readonly url: string,
    public readonly headers: Record<string, string | string[]>,
    public readonly body?: string
  ) {}
}

import { Event } from '../../Bus/Event';
import { Protocol } from '../../RequestExecutor';

export class ExecuteScript implements Event {
  constructor(
    public readonly protocol: Protocol,
    public readonly url: string,
    public readonly headers: Record<string, string | string[]>,
    public readonly method?: string,
    public readonly body?: string
  ) {}
}

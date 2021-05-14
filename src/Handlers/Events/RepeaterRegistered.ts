import { Event } from '../../Bus';

export class RepeaterRegistered implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly version: string,
    public readonly lastUsedVersion: string,
    public readonly script?: string | Record<string, string>
  ) {}
}

import { Event } from '../../Bus';

export class RepeaterRegistering implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly version: string
  ) {}
}

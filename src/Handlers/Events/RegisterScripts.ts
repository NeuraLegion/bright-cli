import { Event } from '../../Bus';

export class RegisterScripts implements Event {
  constructor(public readonly script?: string | Record<string, string>) {}
}

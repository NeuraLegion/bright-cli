import { Event } from '../../Bus';

export enum RepeaterRegisteringError {
  NOT_FOUND = 'not_found',
  NOT_ACTIVE = 'not_active',
  BUSY = 'busy',
  REQUIRES_TO_BE_UPDATED = 'requires_to_be_updated',
  NOT_FOUND = 'not_found'
}

export class RepeaterRegistered implements Event {
  constructor(
    public readonly payload:
      | { version: string; script: string | Record<string, string> | undefined }
      | { error: RepeaterRegisteringError }
  ) {}
}

import { Event } from './Event';

export interface Message<T extends Event> {
  readonly payload: T;
  readonly type?: string;
  readonly sendTo?: string;
  readonly expiresIn?: number;
}

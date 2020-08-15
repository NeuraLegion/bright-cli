import { HandlerType } from './Handler';
import { Event } from './Event';

export interface Bus {
  destroy(): Promise<void>;

  init(): Promise<void>;

  subscribe(handler: HandlerType): Promise<void>;

  publish<T extends Event>(...events: T[]): Promise<void>;
}

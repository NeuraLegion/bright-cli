import { ExecutionResult, HandlerType } from './Handler';
import { Event } from './Event';

export interface Bus {
  destroy(): Promise<void>;

  init(): Promise<void>;

  subscribe(handler: HandlerType): Promise<void>;

  publish<T extends Event, R extends ExecutionResult>(event: T): Promise<R>;
  publish<T extends Event, R extends ExecutionResult>(
    ...event: T[]
  ): Promise<R[]>;
}

export const Bus: unique symbol = Symbol('Bus');

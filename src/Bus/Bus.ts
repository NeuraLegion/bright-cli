import { HandlerType } from './Handler';
import { Event } from './Event';
import { Message } from './Message';

export interface Bus {
  destroy(): Promise<void>;

  init(): Promise<void>;

  send<T, R>(message: Message<T>): Promise<R>;

  subscribe(handler: HandlerType): Promise<void>;

  publish<T extends Event>(event: T): Promise<void>;
}

export const Bus: unique symbol = Symbol('Bus');

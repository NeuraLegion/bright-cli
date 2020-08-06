import { Event } from './Event';

export interface Handler<T extends Event> {
  handle(event: T): Promise<void>;
}

export type HandlerType = new (...args: any[]) => Handler<Event>;

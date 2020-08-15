import { Event } from './Event';

export declare type ExecutionResult = Event | undefined;

export interface Handler<
  T extends Event,
  R extends ExecutionResult = ExecutionResult
> {
  handle(event: T): Promise<R>;
}

export type HandlerType = new (...args: any[]) => Handler<Event>;

export interface HandlerFactory {
  create(ctor: HandlerType): Promise<Handler<Event> | undefined>;
}

export const HandlerFactory: unique symbol = Symbol('HandlerFactory');

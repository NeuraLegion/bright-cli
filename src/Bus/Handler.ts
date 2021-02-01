import { Event } from './Event';

export declare type ExecutionResult = Event | unknown;

export interface Handler<T extends Event, R extends ExecutionResult = void> {
  handle(event: T): Promise<R>;
}

export type HandlerType = new (...args: any[]) => Handler<
  Event,
  ExecutionResult
>;

export const Event: unique symbol = Symbol('Event');

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Event {
  // noop
}

export type EventType<T extends Event = Event> = new (...args: any[]) => T;

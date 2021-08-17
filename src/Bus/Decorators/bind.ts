import 'reflect-metadata';
import { Event, EventType } from '../Event';

export const bind =
  (event: EventType): ClassDecorator =>
  // eslint-disable-next-line @typescript-eslint/ban-types
  (target: Function) => {
    Reflect.defineMetadata(Event, event, target);
  };

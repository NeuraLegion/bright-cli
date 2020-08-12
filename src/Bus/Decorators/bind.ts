import 'reflect-metadata';
import { Event, EventType } from '../Event';

export const bind = (
  event: EventType
  // eslint-disable-next-line @typescript-eslint/ban-types
): ClassDecorator => (target: Function): any => {
  Reflect.defineMetadata(Event, event, target);
};

import { Handler, HandlerType } from '../Handler';
import { Event } from '../Event';

export interface HandlerFactory {
  create(ctor: HandlerType): Promise<Handler<Event> | undefined>;
}

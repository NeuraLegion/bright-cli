import { Event, Handler, HandlerFactory, HandlerType } from '../Bus';
import { interfaces } from 'inversify';

export class DefaultHandlerFactory implements HandlerFactory {
  constructor(private readonly container: interfaces.Container) {}

  public create(ctor: HandlerType): Promise<Handler<Event> | undefined> {
    return this.container.get(ctor);
  }
}

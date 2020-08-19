import { Event, Handler, HandlerRegistry, HandlerType } from '../Bus';
import { RequestExecutor } from '../RequestExecutor';
import { SendRequestHandler } from './SendRequestHandler';

export class DefaultHandlerRegistry implements HandlerRegistry {
  private readonly handlers = new Map<HandlerType, Handler<Event>>();

  constructor(private readonly requestExecutor: RequestExecutor) {
    this.handlers.set(
      SendRequestHandler,
      new SendRequestHandler(this.requestExecutor)
    );
  }

  public async get(ctor: HandlerType): Promise<Handler<Event> | undefined> {
    return this.handlers.get(ctor);
  }
}

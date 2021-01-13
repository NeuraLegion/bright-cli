import {
  Event,
  ExecutionResult,
  Handler,
  HandlerRegistry,
  HandlerType
} from '../Bus';
import { RequestExecutor } from '../RequestExecutor';
import { SendRequestHandler } from './SendRequestHandler';
import { VirtualScripts } from '../Scripts';
import { RegisterScriptsHandler } from './RegisterScriptsHandler';

export class DefaultHandlerRegistry implements HandlerRegistry {
  private readonly handlers = new Map<
    HandlerType,
    Handler<Event, ExecutionResult>
  >();

  constructor(
    private readonly requestExecutor: RequestExecutor,
    private readonly virtualScripts: VirtualScripts
  ) {
    this.handlers
      .set(SendRequestHandler, new SendRequestHandler(this.requestExecutor))
      .set(
        RegisterScriptsHandler,
        new RegisterScriptsHandler(this.virtualScripts)
      );
  }

  public async get(
    ctor: HandlerType
  ): Promise<Handler<Event, ExecutionResult> | undefined> {
    return this.handlers.get(ctor);
  }
}

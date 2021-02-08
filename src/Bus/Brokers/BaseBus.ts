import { ExecutionResult, Handler, HandlerType } from '../Handler';
import { Event, EventType } from '../Event';
import { Bus } from '../Bus';
import { logger } from '../../Utils';
import { DependencyContainer } from 'tsyringe';
import { ok } from 'assert';

export abstract class BaseBus implements Bus {
  private readonly handlers = new Map<
    string,
    Handler<Event, ExecutionResult>
  >();

  protected constructor(private readonly container: DependencyContainer) {}

  public abstract dispatch<T extends Event>(
    eventName: string,
    event: T
  ): Promise<ExecutionResult>;

  public abstract destroy(): Promise<void>;

  public abstract init(): Promise<void>;

  public async publish<T extends Event, R extends ExecutionResult>(
    event: T
  ): Promise<R>;
  public async publish<T extends Event, R extends ExecutionResult>(
    ...event: T[]
  ): Promise<R[]>;
  public async publish(
    ...events: Event[]
  ): Promise<ExecutionResult | ExecutionResult[]> {
    if (!Array.isArray(events) || !events.length) {
      return;
    }

    const result: ExecutionResult[] = await Promise.all(
      events.map((event: Event) => this.publishOne(event))
    );

    return events.length === 1 ? result[0] : result;
  }

  public async subscribe(handler: HandlerType): Promise<void> {
    ok(handler, 'Event handler is not defined.');

    const instance:
      | Handler<Event, ExecutionResult>
      | undefined = await this.container.resolve(handler);

    ok(instance, `Cannot create instance of "${handler.name}" handler.`);

    const eventType: EventType | undefined = Reflect.getMetadata(
      Event,
      handler
    );

    ok(
      eventType,
      `Cannot determine event that "${handler.name}" handler can process.`
    );

    const eventName = eventType.name;

    this.handlers.set(eventName, instance);

    await this.subscribeTo(eventName);
  }

  public getHandler(
    eventName: string
  ): Handler<Event, ExecutionResult> | undefined {
    return this.handlers.get(eventName);
  }

  protected execute(eventName: string, event: Event): Promise<ExecutionResult> {
    const handler:
      | Handler<Event, ExecutionResult>
      | undefined = this.getHandler(eventName);

    ok(handler, `Cannot find a handler for ${eventName} event.`);

    return handler.handle(event);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async subscribeTo(_eventName: string): Promise<void> {
    // noop
  }

  private getEventName(event: Event): string {
    const { constructor } = Object.getPrototypeOf(event);

    return constructor.name as string;
  }

  private publishOne<T>(event: T): Promise<ExecutionResult> {
    const eventName: string = this.getEventName(event);

    logger.debug('Emits %s event with following payload: %j', eventName, event);

    return this.dispatch(eventName, event);
  }
}

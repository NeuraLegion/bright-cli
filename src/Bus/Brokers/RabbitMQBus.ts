import { ExecutionResult, Handler, HandlerType } from '../Handler';
import { Event, EventType } from '../Event';
import { Bus } from '../Bus';
import { Proxy } from '../Proxy';
import { Backoff, logger } from '../../Utils';
import { Message } from '../Message';
import { ConfirmChannel, connect, Connection, ConsumeMessage } from 'amqplib';
import { DependencyContainer, inject, injectable } from 'tsyringe';
import { ok } from 'assert';
import { format, parse, UrlWithParsedQuery } from 'url';
import { EventEmitter, once } from 'events';
import { randomBytes } from 'crypto';
import ErrnoException = NodeJS.ErrnoException;

export interface RabbitMQBusOptions {
  url?: string;
  exchange?: string;
  clientQueue?: string;
  connectTimeout?: number;
  proxyUrl?: string;
  credentials?: {
    username: string;
    password: string;
  };
}

interface ParsedConsumeMessage {
  payload: Event;
  name: string;
  replyTo?: string;
  correlationId?: string;
}

export const RabbitMQBusOptions: unique symbol = Symbol('RabbitMQBusOptions');

@injectable()
export class RabbitMQBus implements Bus {
  private client: Connection;
  private channel: ConfirmChannel;
  private readonly handlers = new Map<
    string,
    Handler<Event, ExecutionResult>
  >();
  private readonly DEFAULT_RECONNECT_TIMES = 20;
  private readonly DEFAULT_HEARTBEAT_INTERVAL = 30;
  private readonly DEFAULT_OPERATIONAL_ERRORS: ReadonlyArray<number> = [
    405, 406, 404, 313, 312, 311, 320
  ];
  private readonly REPLY_QUEUE_NAME = 'amq.rabbitmq.reply-to';
  private readonly APP_QUEUE_NAME = 'app';
  private readonly subject = new EventEmitter();
  private readonly consumerTags: string[] = [];
  private _onReconnectionFailure?: (err: Error) => unknown;

  constructor(
    @inject(RabbitMQBusOptions) private readonly options: RabbitMQBusOptions,
    @inject('tsyringe') private readonly container: DependencyContainer
  ) {
    this.subject.setMaxListeners(Infinity);
  }

  public async destroy(): Promise<void> {
    try {
      if (!this.client) {
        return;
      }

      if (this.channel) {
        await this.channel.waitForConfirms();
        await Promise.all(
          this.consumerTags.map((consumerTag) =>
            this.channel.cancel(consumerTag)
          )
        );
        await this.channel.close();
      }

      await this.client.close();

      this.clear();

      logger.debug('Event bus disconnected from %s', this.options.url);
    } catch (err) {
      logger.error('Cannot terminate event bus gracefully');
      logger.debug('Event bus terminated.');
      logger.debug('Error on disconnect: %s', err.message);
    }
  }

  public async init(): Promise<void> {
    if (this.client) {
      return;
    }

    try {
      const backoff = this.createStartingStrategy();

      await backoff.execute(() => this.connect());
    } catch (e) {
      throw new Error(this.humanizeErrorMessage(e));
    }
  }

  public async subscribe(handler: HandlerType): Promise<void> {
    ok(handler, 'Event handler is not defined.');

    const instance: Handler<Event, ExecutionResult> | undefined =
      this.container.resolve(handler);
    ok(instance, `Cannot create instance of "${handler.name}" handler.`);

    const eventType: EventType | undefined = Reflect.getMetadata(
      Event,
      handler
    );
    ok(
      eventType,
      `Cannot determine event that "${handler.name}" handler can process.`
    );

    this.handlers.set(eventType.name, instance);

    await this.subscribeTo(eventType.name);
  }

  public async send<T extends Event, R>(message: Message<T>): Promise<R> {
    const correlationId = randomBytes(32).toString('hex').slice(0, 32);
    const type: string = message.type ?? this.getEventName(message.payload);
    const routingKey: string = message.sendTo ?? this.APP_QUEUE_NAME;

    process.nextTick(() =>
      this.channel.sendToQueue(
        routingKey,
        Buffer.from(JSON.stringify(message.payload)),
        {
          correlationId,
          type,
          replyTo: this.REPLY_QUEUE_NAME
        }
      )
    );

    try {
      const expiresIn = message.expiresIn ?? 5000;

      const [response]: [R] = await Promise.race([
        once(this.subject, correlationId) as Promise<[R]>,
        new Promise<never>((_, reject) =>
          setTimeout(reject, expiresIn, new Error('No response.')).unref()
        )
      ]);

      return response;
    } catch (e) {
      logger.debug(
        'Cannot send "%s" message: %j. An error occurred: %s',
        type,
        message.payload,
        e.message
      );
      logger.error(
        'Cannot send "%s" message. Please try again later.',
        type,
        e.message
      );

      throw e;
    } finally {
      this.subject.removeAllListeners(correlationId);
    }
  }

  public onReconnectionFailure(handler: (err: Error) => unknown): void {
    this._onReconnectionFailure =
      handler ??
      ((err: Error) => {
        logger.error(err.message);
        process.exit(1);
      });
  }

  public async publish<T extends Event>(event: T): Promise<void> {
    if (!event) {
      return;
    }

    if (!this.channel) {
      return;
    }

    const eventName: string = this.getEventName(event);

    logger.debug(
      'Emits "%s" event with following payload: %j',
      eventName,
      event
    );

    try {
      this.channel.publish(
        this.options.exchange,
        eventName,
        Buffer.from(JSON.stringify(event)),
        {
          contentType: 'application/json',
          mandatory: true,
          persistent: true,
          replyTo: this.REPLY_QUEUE_NAME
        }
      );
    } catch (e) {
      logger.debug(
        'Cannot publish "%s" event: %j. An error occurred: %s',
        eventName,
        event,
        e.message
      );
      logger.error(
        'Cannot publish "%s" event. Please try again later.',
        eventName,
        e.message
      );
    }
  }

  private async subscribeTo(eventName: string): Promise<void> {
    logger.debug(
      'Binds the queue "%s" to "%s" by "%s" routing key.',
      this.options.clientQueue,
      this.options.exchange,
      eventName
    );
    await this.channel.bindQueue(
      this.options.clientQueue,
      this.options.exchange,
      eventName
    );
  }

  private async reconnect(): Promise<void> {
    try {
      this.clear();

      const backoff = this.createRestartingStrategy();

      await backoff.execute(() => this.connect());
    } catch (err) {
      this._onReconnectionFailure?.(err);
    }
  }

  private createStartingStrategy(): Backoff {
    return new Backoff(
      this.DEFAULT_RECONNECT_TIMES,
      (err: ErrnoException): boolean =>
        this.DEFAULT_OPERATIONAL_ERRORS.includes(+err.code)
    );
  }

  private createRestartingStrategy(): Backoff {
    return new Backoff(
      this.DEFAULT_RECONNECT_TIMES,
      (err: ErrnoException): boolean =>
        this.DEFAULT_OPERATIONAL_ERRORS.includes(+err.code) ||
        [
          'ECONNRESET',
          'ENETDOWN',
          'ENETUNREACH',
          'ETIMEDOUT',
          'ECONNREFUSED',
          'ENOTFOUND',
          'EAI_AGAIN'
        ].includes(err.code)
    );
  }

  private parseConsumeMessage(
    message: ConsumeMessage
  ): ParsedConsumeMessage | undefined {
    if (!message.fields.redelivered) {
      const { content, fields, properties } = message;
      const { type, correlationId, replyTo } = properties;
      const { routingKey } = fields;

      const name = type ?? routingKey;

      const payload: Event = JSON.parse(content.toString());

      return { payload, name, correlationId, replyTo };
    }
  }

  private clear(): void {
    this.consumerTags.splice(0, this.consumerTags.length);

    this.channel?.removeAllListeners();
    delete this.channel;

    this.client?.removeAllListeners();
    delete this.client;
  }

  private async connect(): Promise<void> {
    const proxy: Proxy | undefined = this.options.proxyUrl
      ? new Proxy(this.options.proxyUrl)
      : undefined;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.client = await connect(this.prepareUrl(), {
      timeout: this.options.connectTimeout,
      socket: await proxy?.open(this.options.url)
    });

    this.client.on('error', (err: Error) =>
      logger.debug(`Unexpected error: %s`, err.message)
    );

    this.client.on('close', (reason?: Error) =>
      reason ? this.reconnect() : undefined
    );

    await this.createConsumerChannel();

    logger.debug('Event bus connected to %s', this.options.url);
  }

  private prepareUrl(): string {
    const url: UrlWithParsedQuery = parse(this.options.url, true);

    if (this.options.credentials) {
      const { username, password } = this.options.credentials;

      url.auth = `${username}:${password}`;
    }

    url.query = {
      ...url.query,
      frameMax: '0',
      heartbeat: `${this.DEFAULT_HEARTBEAT_INTERVAL}`
    };

    return format(url);
  }

  private getEventName(event: Event): string {
    const { constructor } = Object.getPrototypeOf(event);

    return constructor.name as string;
  }

  private async consumeReceived(message: ConsumeMessage): Promise<void> {
    try {
      const event: ParsedConsumeMessage | undefined =
        this.parseConsumeMessage(message);

      if (event) {
        logger.debug(
          'Received "%s" event with following payload: %j',
          event.name,
          event.payload
        );

        const handler: Handler<Event, ExecutionResult> | undefined =
          this.handlers.get(event.name);

        ok(handler, `Cannot find a handler for ${event.name} event.`);

        const response: ExecutionResult = await handler.handle(event.payload);

        // eslint-disable-next-line max-depth
        if (response) {
          logger.debug(
            'Sending data back with following payload: %j',
            response
          );

          this.channel?.sendToQueue(
            event.replyTo,
            Buffer.from(JSON.stringify(response)),
            {
              mandatory: true,
              correlationId: event.correlationId
            }
          );
        }
      }
    } catch (err) {
      logger.debug('Error processing message: %j. Details: %s', message, err);
      if (message.properties.correlationId) {
        logger.error(
          'Cannot process message with correlation ID: "%s".',
          message.properties.correlationId
        );
      }
      logger.error('Error: %s', err.message);
    }
  }

  private async processReply(message: ConsumeMessage): Promise<void> {
    const event: ParsedConsumeMessage | undefined =
      this.parseConsumeMessage(message);

    if (event) {
      logger.debug(
        'Received message with following payload: %j',
        event.payload
      );

      if (event.correlationId) {
        this.subject.emit(event.correlationId, event.payload);
      }
    }
  }

  private async createConsumerChannel(): Promise<void> {
    if (!this.channel) {
      this.channel = await this.client.createConfirmChannel();
      this.channel.once('close', (reason?: Error) =>
        reason ? this.reconnect() : undefined
      );
      await this.bindExchangesToQueue();
      await this.startBasicConsume();
      await this.startReplyQueueConsume();
    }
  }

  private async startReplyQueueConsume(): Promise<void> {
    const { consumerTag } = await this.channel.consume(
      this.REPLY_QUEUE_NAME,
      (msg: ConsumeMessage | null) => this.processReply(msg),
      {
        noAck: true
      }
    );
    this.consumerTags.push(consumerTag);
  }

  private async startBasicConsume(): Promise<void> {
    const { consumerTag } = await this.channel.consume(
      this.options.clientQueue,
      (msg: ConsumeMessage | null) => this.consumeReceived(msg),
      {
        noAck: true
      }
    );
    this.consumerTags.push(consumerTag);
  }

  private async bindExchangesToQueue(): Promise<void> {
    await this.channel.assertExchange(this.options.exchange, 'direct', {
      durable: true
    });
    await this.channel.assertQueue(this.options.clientQueue, {
      durable: true,
      exclusive: false,
      autoDelete: true
    });
    logger.debug(
      'Binds the queue "%s" to "%s".',
      this.options.clientQueue,
      this.options.exchange
    );
  }

  // eslint-disable-next-line complexity
  private humanizeErrorMessage({ code, message }: ErrnoException): string {
    if (!code) {
      if (message.includes('ACCESS-REFUSED')) {
        return 'Access Refused: Unauthorized access. Please check your credentials.';
      }

      if (message.includes('CHANNEL-ERROR')) {
        return 'Unexpected Error: Channel has been closed, please contact support at support@brightsec.com (issue from out side).';
      }
    }

    switch (code) {
      case 'EAI_AGAIN':
        return `Error Connecting to AMQ Server: Cannot connect to ${this.options.url}, DNS server cannot currently fulfill the request.`;
      case 'ENOTFOUND':
      case 'ETIMEDOUT':
        return `Error Connecting to AMQ Server: Cannot connect to ${this.options.url}, no DNS record found.`;
      case 'ECONNREFUSED':
      case 'ENETDOWN':
      case 'ENETUNREACH':
        return `Cannot connect to ${this.options.url}`;
      case 'ECONNRESET':
        return `Connection was forcibly closed by a peer.`;
      default:
        return message;
    }
  }
}

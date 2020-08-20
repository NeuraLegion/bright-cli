import { Handler, HandlerRegistry, HandlerType } from '../Handler';
import { Event, EventType } from '../Event';
import { Bus } from '../Bus';
import { Proxy } from '../Proxy';
import logger from '../../Utils/Logger';
import { RabbitMQErrorHandler } from './RabbitMQErrorHandler';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { Channel, ConsumeMessage } from 'amqplib';
import { ok } from 'assert';
import { format, parse, UrlWithParsedQuery } from 'url';

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

export class RabbitMQBus implements Bus {
  private client: AmqpConnectionManager;
  private channel: ChannelWrapper;
  private readonly handlers = new Map<string, Handler<Event>>();
  private readonly DEFAULT_RECONNECT_TIMES = 20;
  private readonly DEFAULT_RECONNECT_TIMEOUT = 1;
  private errorHandler?: RabbitMQErrorHandler;

  constructor(
    private readonly options: RabbitMQBusOptions,
    private readonly registry: HandlerRegistry
  ) {}

  public async destroy(): Promise<void> {
    this.errorHandler?.stop();
    delete this.errorHandler;

    await this.channel?.close();
    delete this.channel;

    await this.client?.close();
    delete this.client;

    logger.log('Event bus disconnected from %s', this.options.url);
  }

  public async init(): Promise<void> {
    if (this.client) {
      return;
    }

    const proxy: Proxy | undefined = this.options.proxyUrl
      ? new Proxy(this.options.proxyUrl)
      : undefined;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.client = await require('amqp-connection-manager').connect(
      [this.prepareUrl()],
      {
        reconnectTimeInSeconds: this.DEFAULT_RECONNECT_TIMEOUT,
        connectionOptions: {
          socket: await proxy?.open(this.options.url)
        }
      }
    );

    this.errorHandler = new RabbitMQErrorHandler(
      this.DEFAULT_RECONNECT_TIMES,
      this.client,
      (reconnectTimes: number) =>
        logger.warn(
          'Failed to connect to event bus, retrying in %d second (attempt %d/%d)',
          this.DEFAULT_RECONNECT_TIMEOUT,
          reconnectTimes,
          this.DEFAULT_RECONNECT_TIMES
        )
    );

    await Promise.race([
      this.createConsumerChannel(),
      this.errorHandler.listen()
    ]);

    logger.debug('Event bus connected to RabbitMQ: %j', this.options);
    logger.log('Event bus connected to %s', this.options.url);
  }

  public async subscribe(handler: HandlerType): Promise<void> {
    ok(handler, 'Event handler is not defined.');

    const instance: Handler<Event> | undefined = await this.registry.get(
      handler
    );
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

  public async publish<T extends Event>(...events: T[]): Promise<void> {
    if (!Array.isArray(events) || !events.length) {
      return;
    }

    await Promise.all(
      events.map((event: T) => {
        const eventName: string = this.getEventName(event);

        logger.debug(
          'Emits %s event with following payload: %j',
          eventName,
          event
        );

        return this.channel.publish(
          this.options.exchange,
          eventName,
          Buffer.from(JSON.stringify(event)),
          {
            mandatory: true,
            persistent: true
          }
        );
      })
    );
  }

  protected async subscribeTo(eventName: string): Promise<void> {
    logger.debug(
      'Binds the queue %s to %s by %s routing key.',
      this.options.clientQueue,
      this.options.exchange,
      eventName
    );
    await this.channel.addSetup((channel: Channel) =>
      channel.bindQueue(
        this.options.clientQueue,
        this.options.exchange,
        eventName
      )
    );
  }

  private prepareUrl(): string {
    const url: UrlWithParsedQuery = parse(this.options.url, true);

    if (this.options.credentials) {
      const { username, password } = this.options.credentials;

      url.auth = `${username}:${password}`;
    }

    url.query = { ...url.query, frameMax: '0' };

    return format(url);
  }

  private getEventName(event: Event): string {
    const { constructor } = Object.getPrototypeOf(event);

    return constructor.name as string;
  }

  private async consumeReceived(message: ConsumeMessage): Promise<void> {
    try {
      if (!message.fields.redelivered) {
        const { content, fields, properties } = message;
        const { routingKey } = fields;
        const { correlationId, replyTo, type } = properties;

        const eventType =
          routingKey === this.options.clientQueue ? type : routingKey;

        const event: Event = JSON.parse(content.toString());

        logger.debug(
          'Emits %s event with following payload: %j',
          eventType,
          event
        );

        const handler: Handler<Event> | undefined = this.handlers.get(
          eventType
        );

        ok(handler, `Cannot find a handler for ${eventType} event.`);

        const response: Event | undefined = await handler.handle(event);

        // eslint-disable-next-line max-depth
        if (response) {
          await this.channel.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify(response)),
            {
              correlationId
            }
          );
        }
      }

      this.channel.ack(message);
    } catch (err) {
      logger.debug('Error processing message: %j. Details: %s', message, err);
      logger.error(
        'Cannot process message with correlation ID: %s.',
        message.properties.correlationId
      );
      logger.error('Error: %s', err.message);
      this.channel.nack(message, false, false);
    }
  }

  private async createConsumerChannel(): Promise<void> {
    if (!this.channel) {
      this.channel = this.client.createChannel({
        json: false
      });
      await this.channel.addSetup((channel: Channel) =>
        Promise.all([
          this.bindExchangesToQueue(channel),
          this.startBasicConsume(channel)
        ])
      );
      await this.channel.waitForConnect();
    }
  }

  private async startBasicConsume(channel: Channel): Promise<void> {
    await channel.consume(
      this.options.clientQueue,
      (msg: ConsumeMessage | null) => this.consumeReceived(msg),
      {
        noAck: false
      }
    );
  }

  private async bindExchangesToQueue(channel: Channel): Promise<void> {
    await Promise.all([
      channel.assertExchange(this.options.exchange, 'direct', {
        durable: true
      }),
      channel.assertQueue(this.options.clientQueue, {
        durable: true,
        exclusive: false,
        autoDelete: true
      }),
      channel.prefetch(1)
    ]);
    logger.debug(
      'Binds the queue %s to %s.',
      this.options.clientQueue,
      this.options.exchange
    );
  }
}

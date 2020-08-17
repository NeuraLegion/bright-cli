import { Handler, HandlerRegistry, HandlerType } from '../Handler';
import { Event, EventType } from '../Event';
import { Bus } from '../Bus';
import { Proxy } from '../Proxy';
import logger from '../../Utils/Logger';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { Channel, ConsumeMessage } from 'amqplib';
import { ok } from 'assert';

export interface RabbitMQBusOptions {
  url?: string;
  exchange?: string;
  clientQueue?: string;
  deadLetterExchange?: string;
  deadLetterQueue?: string;
  connectTimeout?: number;
  proxyUrl?: string;
}

export class RabbitMQBus implements Bus {
  private client: AmqpConnectionManager;
  private channel: ChannelWrapper;
  private readonly handlers = new Map<string, Handler<Event>>();

  constructor(
    private readonly options: RabbitMQBusOptions,
    private readonly registry: HandlerRegistry
  ) {}

  public async destroy(): Promise<void> {
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
      [this.options.url],
      {
        connectionOptions: {
          socket: await proxy?.open(this.options.url)
        }
      }
    );

    let connectTimer: NodeJS.Timeout;

    this.client.on('connect', () => clearTimeout(connectTimer));

    if (typeof this.options?.connectTimeout === 'number' && !connectTimer) {
      connectTimer = setTimeout(() => {
        logger.error(
          'Event bus terminated by timeout (%dms)',
          this.options.connectTimeout
        );
        this.destroy();
      }, this.options.connectTimeout);
    }

    await this.createConsumerChannel();

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

  private getEventName(event: Event): string {
    const { constructor } = Object.getPrototypeOf(event);

    return constructor.name as string;
  }

  private async consumeReceived(message: ConsumeMessage): Promise<void> {
    try {
      if (!message.fields.redelivered) {
        const { content, fields } = message;
        const { routingKey } = fields;

        const event: Event = JSON.parse(content.toString());

        logger.debug(
          'Emits %s event with following payload: %j',
          routingKey,
          event
        );

        const handler: Handler<Event> | undefined = this.handlers.get(
          routingKey
        );

        ok(handler, `Cannot find a handler for ${routingKey} event.`);

        const response: Event | undefined = await handler.handle(event);

        // eslint-disable-next-line max-depth
        if (response) {
          await this.channel.sendToQueue(
            message.properties.replyTo,
            Buffer.from(JSON.stringify(response)),
            {
              correlationId: message.properties.correlationId,
              contentType: 'application/json'
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

  private async bindDeadLetterToQueue(channel: Channel): Promise<void> {
    await Promise.all([
      channel.assertExchange(this.options.deadLetterExchange, 'fanout', {
        durable: true
      }),
      channel.assertQueue(this.options.deadLetterQueue, {
        expires: 100000,
        messageTtl: 15000,
        durable: true,
        exclusive: false,
        autoDelete: false
      }),
      channel.bindQueue(
        this.options.deadLetterQueue,
        this.options.deadLetterExchange,
        ''
      )
    ]);
    logger.debug(
      'Binds the queue %s to %s.',
      this.options.deadLetterQueue,
      this.options.deadLetterExchange
    );
  }

  private async createConsumerChannel(): Promise<void> {
    if (!this.channel) {
      this.channel = this.client.createChannel({
        json: false
      });
      await this.channel.addSetup((channel: Channel) =>
        Promise.all([
          this.bindExchangesToQueue(channel),
          this.bindDeadLetterToQueue(channel),
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
        deadLetterExchange: this.options.deadLetterExchange,
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

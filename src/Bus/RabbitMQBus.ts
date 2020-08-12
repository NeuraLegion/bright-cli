import { Handler, HandlerType } from './Handler';
import { Event, EventType } from './Event';
import { HandlerFactory } from './HandlerFactory';
import { Bus } from './Bus';
import { Proxy } from './Proxy/Proxy';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { Channel, ConsumeMessage } from 'amqplib';
import debug, { Debugger } from 'debug';
import { ok } from 'assert';

const log: Debugger = debug('nexploit-cli:bus');

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
    private readonly factory: HandlerFactory
  ) {}

  public async destroy(): Promise<void> {
    await this.channel?.close();
    delete this.channel;

    await this.client?.close();
    delete this.client;

    log('Event bus disconnected from RabbitMQ server');
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
      connectTimer = setTimeout(
        () => void this.destroy(),
        this.options.connectTimeout
      );
    }

    try {
      await this.createConsumerChannel();
    } catch (err) {
      console.error(err);
    }

    log('Event bus connected to Redis server: %j', this.options);
  }

  public async subscribe(handler: HandlerType): Promise<void> {
    ok(handler, 'Event handler is not defined.');

    const instance: Handler<Event> | undefined = await this.factory.create(
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

        log('Emits %s event with following payload: %j', eventName, event);

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
    log(
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

        log('Emits %s event with following payload: %j', routingKey, event);

        const handler: Handler<Event> | undefined = this.handlers.get(
          routingKey
        );

        ok(handler, `Cannot find a handler for ${routingKey} event.`);

        await handler.handle(event);
      }

      this.channel.ack(message);
    } catch (err) {
      log('Error processing message: %j. Details: %s', message, err);
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
    log(
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
  }
}

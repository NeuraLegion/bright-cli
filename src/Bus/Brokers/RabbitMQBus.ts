import { ExecutionResult } from '../Handler';
import { Event } from '../Event';
import { Proxy } from '../Proxy';
import { logger } from '../../Utils';
import { RabbitBackoff } from './RabbitBackoff';
import { BaseBus } from './BaseBus';
import {
  Channel,
  ConfirmChannel,
  connect,
  Connection,
  ConsumeMessage
} from 'amqplib';
import { DependencyContainer, inject, injectable } from 'tsyringe';
import { format, parse, UrlWithParsedQuery } from 'url';

export interface RabbitMQBusOptions {
  url?: string;
  exchange?: string;
  clientQueue?: string;
  connectTimeout?: number;
  proxyUrl?: string;
  onError?: (err: Error) => unknown;
  credentials?: {
    username: string;
    password: string;
  };
}

export const RabbitMQBusOptions: unique symbol = Symbol('RabbitMQBusOptions');

@injectable()
export class RabbitMQBus extends BaseBus {
  private client: Connection;
  private channel: ConfirmChannel;
  private readonly DEFAULT_RECONNECT_TIMES = 20;
  private readonly DEFAULT_RECONNECT_TIMEOUT = 10;
  private readonly DEFAULT_HEARTBEAT_INTERVAL = 30;
  private consumerTag?: string;

  constructor(
    @inject(RabbitMQBusOptions) private readonly options: RabbitMQBusOptions,
    @inject('tsyringe') container: DependencyContainer
  ) {
    super(container);
  }

  public async destroy(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.cancel(this.consumerTag);

        await this.channel.waitForConfirms();
        await this.channel.close();
      }

      await this.client?.close();

      this.clear();

      logger.log('Event bus disconnected from %s', this.options.url);
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

    const backoff = new RabbitBackoff(
      this.DEFAULT_RECONNECT_TIMES,
      1000,
      this.DEFAULT_RECONNECT_TIMEOUT * 1000
    );

    await backoff.execute(() => this.connect());
  }

  public async dispatch<T extends Event>(
    eventName: string,
    event: T
  ): Promise<ExecutionResult> {
    if (!this.channel) {
      return;
    }

    await this.channel.publish(
      this.options.exchange,
      eventName,
      Buffer.from(JSON.stringify(event)),
      {
        contentType: 'application/json',
        mandatory: true,
        persistent: true
      }
    );

    return undefined;
  }

  protected async subscribeTo(eventName: string): Promise<void> {
    logger.debug(
      'Binds the queue %s to %s by %s routing key.',
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

  private onError(err: Error): void {
    logger.error(err.message);
    process.exit(1);
  }

  private async reconnect(): Promise<void> {
    try {
      this.clear();

      const backoff = new RabbitBackoff(
        this.DEFAULT_RECONNECT_TIMES,
        1000,
        this.DEFAULT_RECONNECT_TIMEOUT * 1000
      );

      await backoff.execute(() => this.connect());
    } catch (err) {
      (this.options.onError ?? this.onError)(err);
    }
  }

  private clear(): void {
    delete this.consumerTag;

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

    this.client.on('close', (reason: Error) =>
      reason ? this.reconnect() : undefined
    );

    await this.createConsumerChannel();

    logger.debug('Event bus connected to RabbitMQ: %j', this.options);
    logger.log('Event bus connected to %s', this.options.url);
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

  private async consumeReceived(message: ConsumeMessage): Promise<void> {
    try {
      if (message) {
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

        const response: ExecutionResult = await this.execute(eventType, event);

        // eslint-disable-next-line max-depth
        if (response) {
          logger.debug(
            'Sending data back with following payload: %j',
            response
          );

          this.channel?.sendToQueue(
            replyTo,
            Buffer.from(JSON.stringify(response)),
            {
              correlationId,
              mandatory: true
            }
          );
        }
      }
    } catch (err) {
      logger.debug('Error processing message: %j. Details: %s', message, err);
      if (message.properties.correlationId) {
        logger.error(
          'Cannot process message with correlation ID: %s.',
          message.properties.correlationId
        );
      }
      logger.error('Error: %s', err.message);
    }
  }

  private async createConsumerChannel(): Promise<void> {
    if (!this.channel) {
      this.channel = await this.client.createConfirmChannel();
      this.channel.on('error', (reason: Error) =>
        logger.error('Unexpected error: %s', reason)
      );
      await this.bindExchangesToQueue(this.channel);
      await this.startBasicConsume(this.channel);
    }
  }

  private async startBasicConsume(channel: Channel): Promise<void> {
    const { consumerTag } = await channel.consume(
      this.options.clientQueue,
      (msg: ConsumeMessage | null) => this.consumeReceived(msg),
      {
        noAck: true
      }
    );
    this.consumerTag = consumerTag;
  }

  private async bindExchangesToQueue(channel: Channel): Promise<void> {
    await channel.assertExchange(this.options.exchange, 'direct', {
      durable: true
    });
    await channel.assertQueue(this.options.clientQueue, {
      durable: true,
      exclusive: false,
      autoDelete: true
    });
    await channel.prefetch(0);
    logger.debug(
      'Binds the queue %s to %s.',
      this.options.clientQueue,
      this.options.exchange
    );
  }
}

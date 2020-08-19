import { EventEmitter } from 'events';

export class RabbitMQErrorHandler {
  private reconnectTimes = 0;
  private listener = new EventEmitter();

  constructor(
    private readonly maxReconnectTimes: number = 20,
    private readonly amqp: EventEmitter,
    private readonly onReconnect?: (reconnectTimes: number) => unknown
  ) {}

  public stop(): void {
    this.amqp.off('connect', this.onConnect);
    this.amqp.off('disconnect', this.onDisconnect);
    this.listener.removeAllListeners();
  }

  public listen(): Promise<void> {
    process.nextTick(() => this.subscribe());

    return new Promise((_resolve, reject) =>
      this.listener.once('error', reject)
    );
  }

  private onConnect = () => (this.reconnectTimes = 0);
  private onDisconnect = ({ err }: { err: Error }) => this.error(err);

  private subscribe(): void {
    this.amqp.on('connect', this.onConnect).on('disconnect', this.onDisconnect);
  }

  private error(err?: Error): void {
    if (this.reconnectTimes < this.maxReconnectTimes) {
      this.skip();
    } else {
      this.listener.emit(
        'error',
        new Error(
          this.humanizeErrorMessage(
            err?.message ?? 'Received error on connect.'
          )
        )
      );
    }
  }

  private skip(): void {
    if (this.onReconnect) {
      this.onReconnect(++this.reconnectTimes);
    }
  }

  private humanizeErrorMessage(msg: string): string {
    if (msg.includes('ACCESS-REFUSED')) {
      return 'Unauthorized access. Please check your credentials.';
    }

    if (msg.includes('ENOTFOUND')) {
      return `DNS lookup failed. Cannot resolve provided URL.`;
    }

    if (msg.includes('ECONNREFUSED')) {
      return `Cannot connect to the event bus.`;
    }

    if (msg.includes('ECONNRESET')) {
      return `Connection was forcibly closed by a peer.`;
    }

    return msg;
  }
}

import { logger } from '../../Utils';
import Timeout = NodeJS.Timeout;
import ErrnoException = NodeJS.ErrnoException;

export class RabbitBackoff {
  private backoffTime: number;
  private readonly maximumBackoff: number;
  private readonly maxRetries: number;

  private _times: number;

  get times(): number {
    return this._times;
  }

  constructor(
    maxRetries: number,
    initialBackoff: number,
    maximumBackoff: number
  ) {
    this._times = 0;
    this.maxRetries = maxRetries;
    this.backoffTime = initialBackoff;
    this.maximumBackoff = maximumBackoff;
  }

  // eslint-disable-next-line space-before-function-paren
  public async execute<T extends (...args: any[]) => any>(
    task: T
  ): Promise<ReturnType<T>> {
    try {
      return await task();
    } catch (e) {
      const timeout: number | null = this.next();

      if (!this.isFatal(e) && timeout != null) {
        logger.warn(
          'Failed to connect to event bus, retrying in %d second (attempt %d/%d)',
          timeout / 1000,
          this.times,
          this.maxRetries
        );

        await this.delay(timeout);

        return this.execute(task);
      }

      throw new Error(this.humanizeErrorMessage(e));
    }
  }

  private delay(timeout: number): Promise<void> {
    return new Promise<void>(
      (resolve): Timeout => setTimeout(resolve, timeout)
    );
  }

  private next(): number | undefined {
    if (this._times < this.maxRetries) {
      return this.increaseBackoffTime();
    }
  }

  private increaseBackoffTime(): number {
    this.backoffTime *= Math.pow(2, ++this._times - 1);

    return Math.min(this.backoffTime, this.maximumBackoff);
  }

  private isFatal(err: ErrnoException): boolean {
    return ![406, 405, 404, 313, 312, 311].includes(+err.code);
  }

  private humanizeErrorMessage({ code, message }: ErrnoException): string {
    if (!code) {
      if (message.includes('ACCESS-REFUSED')) {
        return 'Unauthorized access. Please check your credentials.';
      }

      if (message.includes('CHANNEL-ERROR')) {
        return 'Unexpected error. Channel has been closed.';
      }
    }

    switch (code) {
      case 'EAI_AGAIN':
        return `DNS server cannot currently fulfill the request`;
      case 'ENOTFOUND':
        return `DNS lookup failed. Cannot resolve provided URL.`;
      case 'ECONNREFUSED':
        return `Cannot connect to the event bus.`;
      case 'ECONNRESET':
        return `Connection was forcibly closed by a peer.`;
      default:
        return message;
    }
  }
}

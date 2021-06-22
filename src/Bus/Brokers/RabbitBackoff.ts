import { logger } from '../../Utils';
import { promisify } from 'util';
import ErrnoException = NodeJS.ErrnoException;

export class RabbitBackoff {
  private depth: number = 0;
  private readonly delay = promisify(setTimeout);

  constructor(
    private readonly host: string,
    private readonly maxDepth: number
  ) {}

  // eslint-disable-next-line space-before-function-paren
  public async execute<T extends (...args: any[]) => any>(
    task: T
  ): Promise<ReturnType<T>> {
    try {
      return await task();
    } catch (e) {
      if (!this.isFatal(e) && this.depth < this.maxDepth) {
        return this.retry(task);
      }

      throw new Error(this.humanizeErrorMessage(e));
    }
  }

  /* eslint-disable-next-line space-before-function-paren */
  private async retry<T extends (...args: any[]) => any>(
    task: T
  ): Promise<ReturnType<T>> {
    const delay = Math.max(2 ** this.depth * 100, 1000);

    logger.warn(
      'Failed to connect to event bus, retrying in %d second (attempt %d/%d)',
      delay / 1000,
      this.depth + 1,
      this.maxDepth
    );

    await this.delay(delay);

    this.depth++;

    return this.execute(task);
  }

  private isFatal(err: ErrnoException): boolean {
    return ![405, 406, 404, 313, 312, 311, 320].includes(+err.code);
  }

  private humanizeErrorMessage({ code, message }: ErrnoException): string {
    if (!code) {
      if (message.includes('ACCESS-REFUSED')) {
        return 'Access Refused: Unauthorized access. Please check your credentials.';
      }

      if (message.includes('CHANNEL-ERROR')) {
        return 'Unexpected Error: Channel has been closed, please contact support at support@neuralegion.com (issue from out side).';
      }
    }

    switch (code) {
      case 'EAI_AGAIN':
        return `Error Connecting to AMQ Server: Cannot connect to ${this.host}, DNS server cannot currently fulfill the request.`;
      case 'ENOTFOUND':
        return `Error Connecting to AMQ Server: Cannot connect to ${this.host}, no DNS record found.`;
      case 'ECONNREFUSED':
        return `Cannot connect to ${this.host}`;
      case 'ECONNRESET':
        return `Connection was forcibly closed by a peer.`;
      default:
        return message;
    }
  }
}

import { logger } from './Logger';
import { setTimeout } from 'node:timers/promises';

export class Backoff {
  private depth: number = 0;

  constructor(
    private readonly maxDepth: number,
    private readonly shouldRetry: (err: Error) => unknown
  ) {}

  public async execute<T extends (...args: unknown[]) => unknown>(
    task: T
  ): Promise<ReturnType<T>> {
    try {
      return (await task()) as ReturnType<T>;
    } catch (e) {
      if (this.shouldRetry?.(e) && this.depth < this.maxDepth) {
        return this.retry(task);
      }

      throw e;
    }
  }

  /* eslint-disable-next-line space-before-function-paren */
  private async retry<T extends (...args: any[]) => any>(
    task: T
  ): Promise<ReturnType<T>> {
    const delay = Math.max(2 ** this.depth * 100, 1000);

    logger.warn(
      'Failed to connect, retrying in %d second (attempt %d/%d)',
      Math.round(delay / 1000),
      this.depth + 1,
      this.maxDepth
    );

    await setTimeout(delay);

    this.depth++;

    return this.execute(task);
  }
}

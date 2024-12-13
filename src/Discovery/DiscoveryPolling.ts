import { Polling } from '../Utils/Polling';
import { Backoff, ErrorMessageFactory, logger } from '../Utils';
import { DiscoveryPollingConfig } from './DiscoveryPollingFactory';
import { Discoveries } from './Discoveries';
import { DiscoveryStatus, DiscoveryView } from './DiscoveryView';
import axios from 'axios';
import { setTimeout as asyncSetTimeout } from 'node:timers/promises';

export class DiscoveryPolling implements Polling {
  private timeoutDescriptor?: NodeJS.Timeout;
  private defaultInterval: number = 10000;
  private readonly DEFAULT_RECONNECT_TIMES = 20;
  private abortController = new AbortController();

  constructor(
    private readonly options: DiscoveryPollingConfig,
    private readonly discoveryManager: Discoveries
  ) {
    if (!this.options.timeout) {
      logger.warn(
        `Warning: It looks like you've been running polling without "timeout" option.`
      );
      logger.warn(
        `The recommended way to install polling with a minimal timeout: 10-20min.`
      );
    }

    if (this.options.interval) {
      if (this.options.interval < this.defaultInterval) {
        logger.warn(`Warning: polling interval is too small.`);
        logger.warn(`The recommended way to set polling interval to 10s.`);
      }
    }
  }

  public async start(): Promise<void> {
    try {
      logger.log('Starting polling...');
      this.initializePolling();
      await this.runPollingLoop();
    } catch (error) {
      this.handleError(error);
    } finally {
      await this.stop();
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async stop(): Promise<void> {
    this.abortController.abort();
    clearTimeout(this.timeoutDescriptor);
  }

  private initializePolling(): void {
    if (this.options.timeout) {
      this.setTimeout();
    }
  }

  private async runPollingLoop(): Promise<void> {
    for await (const discovery of this.poll()) {
      const shouldContinue = await this.processDiscoveryView(discovery);
      if (!shouldContinue) break;
    }
  }

  private handleError(error: unknown): void {
    if (!this.abortController.signal.aborted) {
      ErrorMessageFactory.genericCommandError({
        error,
        command: 'discovery:polling'
      });
      process.exit(1);
    }
  }

  private setTimeout(timeout: number = this.options.timeout): void {
    this.timeoutDescriptor = setTimeout(() => {
      this.abortController.abort();
      logger.log('Polling has been stopped by timeout.');
    }, timeout);
    logger.debug(`The polling timeout has been set to %d ms.`, timeout);
  }

  private async *poll(): AsyncIterableIterator<DiscoveryView> {
    while (!this.abortController.signal.aborted) {
      const backoff = this.createBackoff();

      const view: DiscoveryView = await backoff.execute(() =>
        this.discoveryManager.get(
          this.options.projectId,
          this.options.discoveryId
        )
      );

      yield view;

      await this.delay();
    }
  }

  private isFinished(status: DiscoveryStatus): boolean {
    return (
      status === DiscoveryStatus.DONE ||
      status === DiscoveryStatus.STOPPED ||
      status === DiscoveryStatus.DISRUPTED ||
      status === DiscoveryStatus.FAILED
    );
  }

  private async delay(): Promise<void> {
    const interval = this.options.interval ?? this.defaultInterval;
    await asyncSetTimeout(interval, false, {
      signal: this.abortController.signal
    });
  }

  private createBackoff(): Backoff {
    return new Backoff(
      this.DEFAULT_RECONNECT_TIMES,
      (err: unknown) =>
        (axios.isAxiosError(err) && err.status > 500) ||
        [
          'ECONNRESET',
          'ENETDOWN',
          'ENETUNREACH',
          'ETIMEDOUT',
          'ECONNREFUSED',
          'ENOTFOUND',
          'EAI_AGAIN',
          'ESOCKETTIMEDOUT'
        ].includes((err as NodeJS.ErrnoException).code)
    );
  }

  private handleDiscoveryStatus(status: DiscoveryStatus): void {
    const statusMessages = {
      [DiscoveryStatus.RUNNING]: 'Discovery is running.',
      [DiscoveryStatus.PENDING]: 'Discovery is pending.',
      [DiscoveryStatus.SCHEDULED]: 'Discovery is scheduled.',
      [DiscoveryStatus.QUEUED]: 'Discovery is queued.',
      [DiscoveryStatus.DONE]: 'Discovery has been completed.',
      [DiscoveryStatus.STOPPED]: 'Discovery has been stopped.',
      [DiscoveryStatus.DISRUPTED]: 'Discovery has been disrupted.',
      [DiscoveryStatus.FAILED]: 'Discovery has failed.'
    };

    const message = statusMessages[status] || `Discovery status is ${status}.`;
    logger.log(message);
  }

  private processDiscoveryView(discovery: DiscoveryView | null): boolean {
    if (!discovery) {
      logger.log('The discovery has not been found.');

      return false;
    }

    this.handleDiscoveryStatus(discovery.status);

    if (this.isFinished(discovery.status)) {
      logger.log(
        `The discovery has been finished with status: ${discovery.status}.`
      );

      return false;
    }

    return true;
  }
}

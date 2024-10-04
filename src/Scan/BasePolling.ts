import { Scans, ScanState, ScanStatus } from './Scans';
import { Polling } from './Polling';
import { Breakpoint } from './Breakpoint';
import { Backoff, logger } from '../Utils';
import { PollingConfig } from './PollingFactory';
import axios from 'axios';
import { ok } from 'node:assert';

export class BasePolling implements Polling {
  private timeoutDescriptor?: NodeJS.Timeout;
  private defaultInterval: number = 10000;
  private readonly DEFAULT_RECONNECT_TIMES = 20;

  private _active = true;

  get active(): boolean {
    return this._active;
  }

  constructor(
    private readonly options: Omit<PollingConfig, 'breakpoint'>,
    private readonly scanManager: Scans,
    private readonly breakpoint: Breakpoint
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

    ok(breakpoint, 'You should choose a breakpoint for polling.');
  }

  public async start(): Promise<void> {
    try {
      logger.log('Starting polling...');

      if (this.options.timeout) {
        this.setTimeout();
      }

      for await (const x of this.poll()) {
        await this.breakpoint.execute(x);
      }
    } finally {
      await this.stop();
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async stop(): Promise<void> {
    if (!this._active) {
      logger.log('Polling has been terminated by timeout.');
    }
    this._active = false;
    clearTimeout(this.timeoutDescriptor);
  }

  private setTimeout(timeout: number = this.options.timeout): void {
    this.timeoutDescriptor = setTimeout(() => (this._active = false), timeout);
    logger.debug(`The polling timeout has been set to %d ms.`, timeout);
  }

  private async *poll(): AsyncIterableIterator<ScanState> {
    while (this.active) {
      await this.delay();

      const backoff = this.createBackoff();

      const state: ScanState = await backoff.execute(() =>
        this.scanManager.status(this.options.scanId)
      );

      if (this.isRedundant(state.status)) {
        break;
      }

      yield state;
    }
  }

  private isRedundant(status: ScanStatus): boolean {
    return (
      status === ScanStatus.DONE ||
      status === ScanStatus.STOPPED ||
      status === ScanStatus.DISRUPTED ||
      status === ScanStatus.FAILED
    );
  }

  private delay(): Promise<void> {
    const interval = this.options.interval ?? this.defaultInterval;

    return new Promise<void>((resolve) => setTimeout(resolve, interval));
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
}

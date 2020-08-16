import { CountIssuesBySeverity, Scans, ScanState, ScanStatus } from './Scans';
import { Polling } from './Polling';
import { Breakpoint } from './Breakpoint';
import ms from 'ms';
import { ok } from 'assert';

export interface PollingConfig {
  timeout?: number | string;
  interval?: number;
  scanId: string;
  scanManager: Scans;
}

export class DefaultPolling implements Polling {
  private options: Omit<PollingConfig, 'scanManager'>;
  private scanManager: Scans;
  private timeoutDescriptor?: NodeJS.Timeout;

  private _active = true;

  get active(): boolean {
    return this._active;
  }

  constructor({ scanManager, ...options }: PollingConfig) {
    this.options = options;
    this.scanManager = scanManager;
  }

  public async start(breakpoint: Breakpoint): Promise<void> {
    ok(breakpoint, 'You should choose a breakpoint for polling.');

    try {
      if (this.options.timeout) {
        this.setTimeout();
      }

      for await (const x of this.poll()) {
        await breakpoint.execute(x);
      }
    } finally {
      await this.stop();
    }
  }

  public async stop(): Promise<void> {
    if (!this._active) {
      console.log('Polling has been terminated by timeout.');
    }
    this._active = false;
    clearTimeout(this.timeoutDescriptor);
  }

  private setTimeout(timeout: number | string = this.options.timeout): void {
    const timeoutInMs: number = this.toMilliseconds(timeout);
    this.timeoutDescriptor = setTimeout(
      () => (this._active = false),
      timeoutInMs
    );
  }

  private async *poll(): AsyncIterableIterator<CountIssuesBySeverity[]> {
    while (this.active) {
      await this.delay();

      const {
        status,
        issuesBySeverity
      }: ScanState = await this.scanManager.status(this.options.scanId);

      if (this.isRedundant(status)) {
        break;
      }

      yield issuesBySeverity;
    }
  }

  private toMilliseconds(time: string | number): number {
    if (typeof time === 'string') {
      const milliseconds = ms(time);
      if (!milliseconds) {
        return;
      }

      return milliseconds;
    } else if (typeof time === 'number') {
      return time;
    }
  }

  private isRedundant(status: ScanStatus): boolean {
    return (
      status === ScanStatus.DONE ||
      status === ScanStatus.STOPPED ||
      status === ScanStatus.FAILED
    );
  }

  private delay(): Promise<void> {
    const interval = this.toMilliseconds(this.options.interval) ?? 5000;

    return new Promise<void>((resolve) => setTimeout(resolve, interval));
  }
}

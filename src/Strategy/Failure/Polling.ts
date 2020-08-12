import { FailureStrategy } from './FailureStrategy';
import request from 'request-promise';
import { RequestPromiseAPI } from 'request-promise';
import ms from 'ms';
import { SocksProxyAgent } from 'socks-proxy-agent';

export enum FailureOnType {
  FIRST_ISSUE = 'first-issue',
  FIRST_MEDIUM_SEVERITY_ISSUE = 'first-medium-severity-issue',
  FIRST_HIGH_SEVERITY_ISSUE = 'first-high-severity-issue',
  NONE = 'none'
}

export interface PollingConfig {
  timeout?: number | string;
  interval?: number;
  scanId?: string;
  baseUrl: string;
  proxyUrl?: string;
  apiKey: string;
}

export enum IssueCategory {
  MEDIUM = 'Medium',
  HIGH = 'High',
  LOW = 'Low'
}

export interface StatsIssuesCategory {
  number: number;
  type: IssueCategory;
}

export enum ScanStatus {
  RUNNING = 'running',
  PENDING = 'pending',
  STOPPED = 'stopped',
  FAILED = 'failed',
  DONE = 'done',
  SCHEDULED = 'scheduled',
  QUEUED = 'queued'
}

export interface ScanState {
  status: ScanStatus;
  issuesBySeverity: StatsIssuesCategory[];
}

export class Polling {
  private readonly proxy: RequestPromiseAPI;

  private _active = true;

  get active(): boolean {
    return this._active;
  }

  constructor(private readonly options: PollingConfig) {
    const { baseUrl, proxyUrl, apiKey } = options;
    this.proxy = request.defaults({
      baseUrl,
      agent: proxyUrl ? new SocksProxyAgent(proxyUrl) : undefined,
      headers: { authorization: `Api-Key ${apiKey}` }
    });
  }

  public async check(strategy: FailureStrategy): Promise<void> {
    if (!strategy) {
      throw new Error('You should specify a failure strategy for polling.');
    }
    let timeoutDescriptor;

    try {
      if (this.options.timeout) {
        const timeout: number = this.toMilliseconds(this.options.timeout);
        timeoutDescriptor = setTimeout(() => (this._active = false), timeout);
      }

      for await (const x of this.poll()) {
        await strategy.execute(x);
      }
    } finally {
      if (!this._active) {
        console.log('Polling has been terminated by timeout.');
      }
      this._active = false;
      clearTimeout(timeoutDescriptor);
    }
  }

  private async *poll(): AsyncIterableIterator<StatsIssuesCategory[]> {
    while (this.active) {
      await this.delay();

      const { status, issuesBySeverity }: ScanState = await this.proxy.get({
        uri: `/api/v1/scans/${this.options.scanId}`,
        json: true
      });

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

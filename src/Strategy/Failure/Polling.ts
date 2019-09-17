import * as request from 'request-promise';
import { RequestPromiseAPI } from 'request-promise';
import { FailureStrategy } from './FailureStrategy';

export enum FailureOnType {
  firstIssue = 'first-issue',
  firstMediumSeverityIssue = 'first-medium-severity-issue',
  firstHighSeverityIssue = 'first-high-severity-issue',
  none = 'none'
}

export interface PollingConfig {
  poolingInterval?: number;
  scanId?: string;
}

export enum IssueCategory {
  medium = 'Medium',
  high = 'High',
  low = 'Low'
}

export interface StatsIssuesCategory {
  number: number;
  type: IssueCategory;
}

export enum ScanStatus {
  running = 'running',
  pending = 'pending',
  stopped = 'stopped',
  done = 'done',
  scheduled = 'scheduled',
  queued = 'queued'
}

export interface ScanState {
  status: ScanStatus;
  issuesBySeverity: StatsIssuesCategory[];
}

export class Polling {
  private readonly proxy: RequestPromiseAPI;
  private readonly options: PollingConfig;
  private proxyConfig: {
    strictSSL: boolean;
    headers: { Authorization: string };
    baseUrl: string;
  };

  constructor(baseUrl: string, apiKey: string, options: PollingConfig) {
    this.proxyConfig = {
      baseUrl,
      strictSSL: false,
      headers: { Authorization: `Api-Key ${apiKey}` }
    };
    this.proxy = request.defaults(this.proxyConfig);
    this.options = options;
  }

  public async check(strategy: FailureStrategy): Promise<void> {
    if (!strategy) {
      throw new Error('You should specify a failure strategy for polling.');
    }

    for await (const x of this.poll()) {
      await strategy.execute(x);
    }
  }

  private async *poll(): AsyncIterableIterator<StatsIssuesCategory[]> {
    while (true) {
      await this.delay();

      const { status, issuesBySeverity }: ScanState = await this.getStatus();

      if (this.isRedundant(status)) {
        break;
      }

      yield issuesBySeverity;
    }
  }

  private isRedundant(status: ScanStatus): boolean {
    return status === ScanStatus.done || status === ScanStatus.stopped;
  }

  private delay(): Promise<void> {
    return new Promise<void>((resolve) =>
      setTimeout(resolve, this.options.poolingInterval)
    );
  }

  protected getStatus(): Promise<ScanState> {
    return this.proxy.get({
      uri: `/api/v1/scans/${this.options.scanId}`,
      json: true
    }) as any;
  }
}

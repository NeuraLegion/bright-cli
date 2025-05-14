import { Polling } from '../Utils/Polling';
import { Backoff, ErrorMessageFactory, logger } from '../Utils';
import { HostUpdateJobStatusPollingConfig } from './HostUpdateJobStatusPollingFactory';
import { EntryPoints, HostUpdateJobStatusView, JobStatus } from './EntryPoints';
import axios from 'axios';
import { setTimeout as asyncSetTimeout } from 'node:timers/promises';

export class HostUpdateJobStatusPolling implements Polling {
  private timeoutDescriptor?: NodeJS.Timeout;
  private defaultInterval: number = 10000;
  private readonly DEFAULT_RECONNECT_TIMES = 20;
  private abortController = new AbortController();

  constructor(
    private readonly options: HostUpdateJobStatusPollingConfig,
    private readonly entryPoints: EntryPoints
  ) {
    if (!this.options.timeout) {
      logger.warn(
        `Warning: It looks like you've been running polling without "timeout" option.`
      );
      logger.warn(
        `The recommended way to install polling with a minimal timeout: 10-60min.`
      );
    }

    if (this.options.interval) {
      if (this.options.interval < this.defaultInterval) {
        logger.warn(
          `Warning: The minimal value for polling interval is 10 seconds.`
        );
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
    for await (const jobView of this.poll()) {
      const shouldContinue = await this.processJobView(jobView);
      if (!shouldContinue) break;
    }
  }

  private handleError(error: unknown): void {
    if (!this.abortController.signal.aborted) {
      logger.error(
        ErrorMessageFactory.genericCommandError({
          error,
          command: 'entrypoints:update-host-polling'
        })
      );
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

  private async *poll(): AsyncIterableIterator<HostUpdateJobStatusView> {
    while (!this.abortController.signal.aborted) {
      const backoff = this.createBackoff();

      const view: HostUpdateJobStatusView = await backoff.execute(() =>
        this.entryPoints.getHostUpdateJobStatus({
          jobId: this.options.jobId,
          projectId: this.options.projectId
        })
      );

      logger.debug('Host update job data: %j', view);

      yield view;

      await this.delay();
    }
  }

  private isFinished(status: JobStatus): boolean {
    return status === JobStatus.COMPLETED || status === JobStatus.FAILED;
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

  private handleJobStatus(status: JobStatus): void {
    const statusMessages = {
      [JobStatus.PENDING]: 'Host update job is pending.',
      [JobStatus.PROCESSING]: 'Host update job is processing.',
      [JobStatus.COMPLETED]: 'Host update job has been completed.',
      [JobStatus.FAILED]: 'Host update job has failed.'
    };

    const message =
      statusMessages[status] || `Host update job status is ${status}.`;
    logger.log(message);
  }

  private processJobView(job: HostUpdateJobStatusView | null): boolean {
    if (!job) {
      logger.log('The host update job has not been found.');

      return false;
    }

    this.handleJobStatus(job.status);

    if (this.isFinished(job.status)) {
      logger.log(
        `The host update job has been finished with status: ${job.status}.`
      );

      return false;
    }

    return true;
  }
}

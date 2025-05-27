import 'reflect-metadata';
import { Logger, logger } from '../Utils';
import { HostUpdateJobStatusPollingConfig } from './HostUpdateJobStatusPollingFactory';
import { EntryPoints, HostUpdateJobStatusView, JobStatus } from './EntryPoints';
import { HostUpdateJobStatusPolling } from './HostUpdateJobStatusPolling';
import {
  deepEqual,
  instance,
  mock,
  reset,
  spy,
  verify,
  when
} from 'ts-mockito';
import { setTimeout } from 'node:timers/promises';

describe('HostUpdateJobStatusPolling', () => {
  const jobId = 'test-job-123';
  const projectId = 'hADZjiahZqpvgK3yNEdp8b';

  const firstResponse: HostUpdateJobStatusView = {
    jobId,
    status: JobStatus.PROCESSING,
    totalCount: 1,
    processedCount: 0,
    skippedCount: 0
  };

  const entryPointsMock = mock<EntryPoints>();

  let loggerSpy!: Logger;

  beforeEach(() => {
    loggerSpy = spy(logger);
  });

  afterEach(() => {
    reset<EntryPoints | Logger>(entryPointsMock, loggerSpy);
  });

  describe('constructor', () => {
    it('should warn if timeout is not specified', () => {
      // arrange
      const options: HostUpdateJobStatusPollingConfig = {
        projectId,
        jobId
      };

      // act
      new HostUpdateJobStatusPolling(options, instance(entryPointsMock));

      // assert
      verify(
        loggerSpy.warn(
          `Warning: It looks like you've been running polling without "timeout" option.`
        )
      ).once();
      verify(
        loggerSpy.warn(
          `The recommended way to install polling with a minimal timeout: 10-60min.`
        )
      ).once();
    });

    it('should warn if interval is less than 10s', () => {
      // arrange
      const options: HostUpdateJobStatusPollingConfig = {
        projectId,
        jobId,
        interval: 5000
      };

      // act
      new HostUpdateJobStatusPolling(options, instance(entryPointsMock));

      // assert
      verify(
        loggerSpy.warn(
          `Warning: The minimal value for polling interval is 10 seconds.`
        )
      ).once();
    });
  });

  describe('start', () => {
    const options: HostUpdateJobStatusPollingConfig = {
      jobId,
      projectId,
      interval: 1
    };
    const spiedOptions = spy(options);

    let sut!: HostUpdateJobStatusPolling;

    beforeEach(() => {
      sut = new HostUpdateJobStatusPolling(options, instance(entryPointsMock));
    });

    afterEach(() => reset(spiedOptions));

    it.each([JobStatus.COMPLETED, JobStatus.FAILED])(
      'should start polling and stop on host update status changed to "%s"',
      async (status) => {
        // arrange
        when(
          entryPointsMock.getHostUpdateJobStatus(
            deepEqual({
              jobId,
              projectId
            })
          )
        )
          .thenResolve(firstResponse)
          .thenResolve({ ...firstResponse, status });

        // act
        await sut.start();

        // assert
        verify(
          entryPointsMock.getHostUpdateJobStatus(
            deepEqual({
              jobId,
              projectId
            })
          )
        ).twice();
        verify(
          loggerSpy.log(
            `The host update job has been finished with status: ${status}.`
          )
        ).once();
      }
    );

    it('should start polling and stop on timeout', async () => {
      // arrange
      const timeout = 1500;
      const interval = 1000;
      when(spiedOptions.timeout).thenReturn(timeout);
      when(spiedOptions.interval).thenReturn(interval);

      when(
        entryPointsMock.getHostUpdateJobStatus(
          deepEqual({
            jobId,
            projectId
          })
        )
      ).thenResolve(firstResponse);

      // act
      jest.useFakeTimers();
      const promise = sut.start();
      await setTimeout(10);
      jest.runAllTimers();
      await promise;
      jest.useRealTimers();

      // assert
      verify(
        entryPointsMock.getHostUpdateJobStatus(
          deepEqual({
            jobId,
            projectId
          })
        )
      ).once();
      verify(loggerSpy.log('Polling has been stopped by timeout.')).once();
    });
  });

  describe('stop', () => {
    it('should stop polling', async () => {
      // arrange
      const sut = new HostUpdateJobStatusPolling(
        {
          projectId,
          jobId,
          interval: 1000
        },
        instance(entryPointsMock)
      );

      when(
        entryPointsMock.getHostUpdateJobStatus(
          deepEqual({
            jobId,
            projectId
          })
        )
      ).thenResolve(firstResponse);

      // act
      const start = sut.start();
      await setTimeout(10);
      await sut.stop();
      await start;

      // assert
      verify(
        entryPointsMock.getHostUpdateJobStatus(
          deepEqual({
            jobId,
            projectId
          })
        )
      ).once();
    });
  });
});

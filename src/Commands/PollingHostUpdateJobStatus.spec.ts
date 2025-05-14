import 'reflect-metadata';
import { Logger, logger, ErrorMessageFactory } from '../Utils';
import { PollingHostUpdateJobStatus } from './PollingHostUpdateJobStatus';
import { HostUpdateJobStatusPollingFactory } from '../EntryPoint/HostUpdateJobStatusPollingFactory';
import { Polling } from '../Utils/Polling';
import {
  mock,
  reset,
  spy,
  instance,
  when,
  anything,
  verify,
  objectContaining
} from 'ts-mockito';
import { container } from 'tsyringe';
import { Arguments } from 'yargs';

describe('PollingHostUpdateJobStatus', () => {
  let processSpy!: NodeJS.Process;
  let loggerSpy!: Logger;

  beforeEach(() => {
    processSpy = spy(process);
    loggerSpy = spy(logger);
  });

  afterEach(() => reset<NodeJS.Process | Logger>(processSpy, loggerSpy));

  describe('handler', () => {
    let pollingHostUpdateJobStatus: PollingHostUpdateJobStatus;
    const mockedPollingFactory = mock<HostUpdateJobStatusPollingFactory>();

    const mockedPollingStart = jest.fn();
    const mockedPollingStop = jest.fn();

    const mockedPolling: Polling = {
      start: mockedPollingStart,
      stop: mockedPollingStop
    };

    beforeEach(() => {
      container.registerInstance(
        HostUpdateJobStatusPollingFactory,
        instance(mockedPollingFactory)
      );
      pollingHostUpdateJobStatus = new PollingHostUpdateJobStatus();
    });

    afterEach(() => {
      container.clearInstances();
      reset(mockedPollingFactory);
      jest.clearAllMocks();
    });

    it('should correctly configure polling from args', async () => {
      const args = {
        project: 'project-id',
        jobId: 'job-123',
        token: 'api-token',
        interval: 1000,
        timeout: 30000,
        _: ['job-123'],
        $0: ''
      } as Arguments;

      when(processSpy.exit(anything())).thenReturn(undefined);
      when(
        mockedPollingFactory.create(
          objectContaining({
            projectId: 'project-id',
            jobId: 'job-123',
            interval: 1000,
            timeout: 30000
          })
        )
      ).thenReturn(mockedPolling as Polling);

      await pollingHostUpdateJobStatus.handler(args);

      // Verify polling.start was called
      expect(mockedPolling.start).toHaveBeenCalled();

      // Verify process.exit was called with 0 (success)
      verify(processSpy.exit(0)).once();

      // Verify logger.error was never called
      verify(loggerSpy.error(anything())).never();
    });

    it('should use default interval if not specified', async () => {
      const args = {
        project: 'project-id',
        jobId: 'job-123',
        token: 'api-token',
        timeout: 30000,
        _: ['job-123'],
        $0: ''
      } as Arguments;

      when(processSpy.exit(anything())).thenReturn(undefined);
      when(
        mockedPollingFactory.create(
          objectContaining({
            projectId: 'project-id',
            jobId: 'job-123',
            timeout: 30000
          })
        )
      ).thenReturn(mockedPolling);

      await pollingHostUpdateJobStatus.handler(args);

      expect(mockedPolling.start).toHaveBeenCalled();
      verify(processSpy.exit(0)).once();
    });

    it('should handle errors correctly', async () => {
      const args = {
        project: 'project-id',
        jobId: 'job-123',
        token: 'api-token',
        _: ['job-123'],
        $0: ''
      } as Arguments;

      const error = new Error('Polling failed');

      when(processSpy.exit(anything())).thenReturn(undefined);
      when(mockedPollingFactory.create(anything())).thenReturn(mockedPolling);

      mockedPollingStart.mockRejectedValue(error);

      await pollingHostUpdateJobStatus.handler(args);

      // Verify logger.error was called with appropriate error message
      verify(
        loggerSpy.error(
          ErrorMessageFactory.genericCommandError({
            error,
            command: 'entrypoints:update-host-polling'
          })
        )
      ).once();

      // Verify process.exit was called with 1 (error)
      verify(processSpy.exit(1)).once();
    });
  });
});

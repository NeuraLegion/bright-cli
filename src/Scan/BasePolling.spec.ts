import 'reflect-metadata';
import { Breakpoint } from './Breakpoint';
import { Logger, logger } from '../Utils';
import { BasePolling } from './BasePolling';
import { Scans, ScanState, ScanStatus } from './Scans';
import {
  instance,
  mock,
  objectContaining,
  reset,
  spy,
  verify,
  when
} from 'ts-mockito';

describe('BasePolling', () => {
  const breakpointMock = mock<Breakpoint>();
  const scanManagerMock = mock<Scans>();

  let loggerSpy!: Logger;

  beforeEach(() => {
    loggerSpy = spy(logger);
  });

  afterEach(() => {
    reset<Breakpoint | Scans | Logger>(
      breakpointMock,
      scanManagerMock,
      loggerSpy
    );
  });

  describe('constructor', () => {
    it('should warn if timeout is not specified', () => {
      // arrange
      const options = {
        scanId: 'scanId'
      };

      // act
      new BasePolling(
        options,
        instance(scanManagerMock),
        instance(breakpointMock)
      );

      // assert
      verify(
        loggerSpy.warn(
          `Warning: It looks like you've been running polling without "timeout" option.`
        )
      ).once();
      verify(
        loggerSpy.warn(
          `The recommended way to install polling with a minimal timeout: 10-20min.`
        )
      ).once();
    });

    it('should warn if interval is less than 10s', () => {
      // arrange
      const options = {
        scanId: 'scanId',
        interval: 5000
      };

      // act
      new BasePolling(
        options,
        instance(scanManagerMock),
        instance(breakpointMock)
      );

      // assert
      verify(loggerSpy.warn(`Warning: polling interval is too small.`)).once();
      verify(
        loggerSpy.warn(`The recommended way to set polling interval to 10s.`)
      ).once();
    });
  });

  describe('start', () => {
    it('should start polling and stop on breakpoint exception', async () => {
      // arrange
      const scanId = 'scanId';
      const sut = new BasePolling(
        {
          scanId,
          interval: 1
        },
        instance(scanManagerMock),
        instance(breakpointMock)
      );
      const response: ScanState = {
        numberOfHighSeverityIssues: 0,
        numberOfCriticalSeverityIssues: 0,
        numberOfLowSeverityIssues: 0,
        numberOfMediumSeverityIssues: 0,
        status: ScanStatus.RUNNING
      };
      when(scanManagerMock.status(scanId))
        .thenResolve(response)
        .thenResolve({ ...response, numberOfLowSeverityIssues: 1 });

      when(
        breakpointMock.execute(
          objectContaining({ numberOfLowSeverityIssues: 1 })
        )
      ).thenReject(new Error('breakpoint error'));
      // act
      const act = sut.start();
      // assert
      await expect(act).rejects.toThrow('breakpoint error');
      verify(loggerSpy.log('Starting polling...')).once();
      verify(scanManagerMock.status(scanId)).twice();
    });

    it.each([
      ScanStatus.DONE,
      ScanStatus.DISRUPTED,
      ScanStatus.FAILED,
      ScanStatus.STOPPED
    ])(
      'should start polling and stop on scan status changed to "%s"',
      async (status) => {
        // arrange
        const scanId = 'scanId';
        const sut = new BasePolling(
          {
            scanId,
            interval: 1
          },
          instance(scanManagerMock),
          instance(breakpointMock)
        );
        const response: ScanState = {
          numberOfHighSeverityIssues: 0,
          numberOfCriticalSeverityIssues: 0,
          numberOfLowSeverityIssues: 0,
          numberOfMediumSeverityIssues: 0,
          status: ScanStatus.RUNNING
        };
        when(scanManagerMock.status(scanId))
          .thenResolve(response)
          .thenResolve({ ...response, status });

        // act
        await sut.start();
        // assert
        verify(scanManagerMock.status(scanId)).twice();
      }
    );

    it('should start polling and stop on timeout', async () => {
      // arrange
      const scanId = 'scanId';
      const timeout = 10000;
      const sut = new BasePolling(
        {
          scanId,
          timeout,
          interval: 1
        },
        instance(scanManagerMock),
        instance(breakpointMock)
      );
      const response: ScanState = {
        numberOfHighSeverityIssues: 0,
        numberOfCriticalSeverityIssues: 0,
        numberOfLowSeverityIssues: 0,
        numberOfMediumSeverityIssues: 0,
        status: ScanStatus.RUNNING
      };
      when(scanManagerMock.status(scanId)).thenResolve(response);

      // act
      jest.useFakeTimers();
      const promise = sut.start();
      jest.runAllTimers();
      await promise;
      jest.useRealTimers();

      // assert
      verify(scanManagerMock.status(scanId)).once();
      verify(loggerSpy.log('Polling has been terminated by timeout.')).once();
    });
  });

  describe('stop', () => {
    it('should stop polling', async () => {
      // arrange
      const scanId = 'scanId';
      const sut = new BasePolling(
        {
          scanId,
          interval: 1
        },
        instance(scanManagerMock),
        instance(breakpointMock)
      );

      const response: ScanState = {
        numberOfHighSeverityIssues: 0,
        numberOfCriticalSeverityIssues: 0,
        numberOfLowSeverityIssues: 0,
        numberOfMediumSeverityIssues: 0,
        status: ScanStatus.RUNNING
      };
      when(scanManagerMock.status(scanId)).thenResolve(response);

      // act
      const start = sut.start();
      await sut.stop();
      await start;

      // assert
      verify(scanManagerMock.status(scanId)).once();
    });
  });
});

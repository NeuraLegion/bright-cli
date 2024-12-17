import 'reflect-metadata';
import { Breakpoint } from './Breakpoint';
import { Logger, logger } from '../Utils';
import { BasePolling } from './BasePolling';
import { Scans, ScanState, ScanStatus } from './Scans';
import { PollingConfig } from './PollingFactory';
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
  const firstResponse: ScanState = {
    numberOfHighSeverityIssues: 0,
    numberOfCriticalSeverityIssues: 0,
    numberOfLowSeverityIssues: 0,
    numberOfMediumSeverityIssues: 0,
    status: ScanStatus.RUNNING
  };
  const scanId = 'hAXZjjahZqpvgK3yNEdp6t';

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
        scanId
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
        scanId,
        interval: 5000
      };

      // act
      new BasePolling(
        options,
        instance(scanManagerMock),
        instance(breakpointMock)
      );

      // assert
      verify(loggerSpy.warn(`Warning: The minimal value for polling interval is 10 seconds.`)).once();
    });
  });

  describe('start', () => {
    const options: Omit<PollingConfig, 'breakpoint'> = { scanId, interval: 1 };
    const spiedOptions = spy(options);

    let sut!: BasePolling;

    beforeEach(() => {
      sut = new BasePolling(
        options,
        instance(scanManagerMock),
        instance(breakpointMock)
      );
    });

    afterEach(() => reset(spiedOptions));

    it('should start polling and stop on breakpoint exception', async () => {
      // arrange

      when(scanManagerMock.status(scanId))
        .thenResolve(firstResponse)
        .thenResolve({ ...firstResponse, numberOfLowSeverityIssues: 1 });

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
        when(scanManagerMock.status(scanId))
          .thenResolve(firstResponse)
          .thenResolve({ ...firstResponse, status });

        // act
        await sut.start();

        // assert
        verify(scanManagerMock.status(scanId)).twice();
      }
    );

    it('should start polling and stop on timeout', async () => {
      // arrange
      const timeout = 10000;
      when(spiedOptions.timeout).thenReturn(timeout);

      when(scanManagerMock.status(scanId)).thenResolve(firstResponse);

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
      const sut = new BasePolling(
        {
          scanId,
          interval: 1
        },
        instance(scanManagerMock),
        instance(breakpointMock)
      );

      when(scanManagerMock.status(scanId)).thenResolve(firstResponse);

      // act
      const start = sut.start();
      await sut.stop();
      await start;

      // assert
      verify(scanManagerMock.status(scanId)).once();
    });
  });
});

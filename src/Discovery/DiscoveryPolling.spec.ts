import 'reflect-metadata';
import { Logger, logger } from '../Utils';
import { DiscoveryPollingConfig } from './DiscoveryPollingFactory';
import { DiscoveryView, DiscoveryStatus } from './DiscoveryView';
import { Discoveries } from './Discoveries';
import { DiscoveryPolling } from './DiscoveryPolling';
import { instance, mock, reset, spy, verify, when } from 'ts-mockito';
import { setTimeout } from 'node:timers/promises';

describe('DiscoveryPolling', () => {
  const discoveryId = 'hAXZjjahZqpvgK3yNEdp6t';
  const projectId = 'hADZjiahZqpvgK3yNEdp8b';

  const firstResponse: DiscoveryView = {
    id: discoveryId,
    name: 'some name',
    status: DiscoveryStatus.RUNNING
  };

  const discoveryManagerMock = mock<Discoveries>();

  let loggerSpy!: Logger;

  beforeEach(() => {
    loggerSpy = spy(logger);
  });

  afterEach(() => {
    reset<Discoveries | Logger>(discoveryManagerMock, loggerSpy);
  });

  describe('constructor', () => {
    it('should warn if timeout is not specified', () => {
      // arrange
      const options: DiscoveryPollingConfig = {
        projectId,
        discoveryId
      };

      // act
      new DiscoveryPolling(options, instance(discoveryManagerMock));

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
        discoveryId,
        projectId,
        interval: 5000
      };

      // act
      new DiscoveryPolling(options, instance(discoveryManagerMock));

      // assert
      verify(loggerSpy.warn(`Warning: polling interval is too small.`)).once();
      verify(
        loggerSpy.warn(`The recommended way to set polling interval to 10s.`)
      ).once();
    });
  });

  describe('start', () => {
    const options: DiscoveryPollingConfig = {
      discoveryId,
      projectId,
      interval: 1
    };
    const spiedOptions = spy(options);

    let sut!: DiscoveryPolling;

    beforeEach(() => {
      sut = new DiscoveryPolling(options, instance(discoveryManagerMock));
    });

    afterEach(() => reset(spiedOptions));

    it.each([
      DiscoveryStatus.DONE,
      DiscoveryStatus.DISRUPTED,
      DiscoveryStatus.FAILED,
      DiscoveryStatus.STOPPED
    ])(
      'should start polling and stop on discovery status changed to "%s"',
      async (status) => {
        // arrange
        when(discoveryManagerMock.get(projectId, discoveryId))
          .thenResolve(firstResponse)
          .thenResolve({ ...firstResponse, status });

        // act
        await sut.start();

        // assert
        verify(discoveryManagerMock.get(projectId, discoveryId)).twice();
        verify(
          loggerSpy.log(
            `The discovery has been finished with status: ${status}.`
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

      when(discoveryManagerMock.get(projectId, discoveryId)).thenResolve(
        firstResponse
      );

      // act
      jest.useFakeTimers();
      const promise = sut.start();
      await setTimeout(10);
      jest.runAllTimers();
      await promise;
      jest.useRealTimers();

      // assert
      verify(discoveryManagerMock.get(projectId, discoveryId)).once();
      verify(loggerSpy.log('Polling has been stopped by timeout.')).once();
    });
  });

  describe('stop', () => {
    it('should stop polling', async () => {
      // arrange
      const sut = new DiscoveryPolling(
        {
          projectId,
          discoveryId,
          interval: 1000
        },
        instance(discoveryManagerMock)
      );

      when(discoveryManagerMock.get(projectId, discoveryId)).thenResolve(
        firstResponse
      );

      // act
      const start = sut.start();
      await setTimeout(10);
      await sut.stop();
      await start;

      // assert
      verify(discoveryManagerMock.get(projectId, discoveryId)).once();
    });
  });
});

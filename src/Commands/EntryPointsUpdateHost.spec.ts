import 'reflect-metadata';
import { Logger, logger, ErrorMessageFactory } from '../Utils';
import { EntryPointsUpdateHost } from './EntryPointsUpdateHost';
import { EntryPoints } from '../EntryPoint';
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

describe('EntryPointsUpdateHost', () => {
  let processSpy!: NodeJS.Process;
  let loggerSpy!: Logger;

  beforeEach(() => {
    processSpy = spy(process);
    loggerSpy = spy(logger);
  });

  afterEach(() => reset<NodeJS.Process | Logger>(processSpy, loggerSpy));

  describe('handler', () => {
    let entryPointsUpdateHost: EntryPointsUpdateHost;
    const mockedEntryPoints = mock<EntryPoints>();

    beforeEach(() => {
      container.registerInstance(EntryPoints, instance(mockedEntryPoints));
      entryPointsUpdateHost = new EntryPointsUpdateHost();
    });

    afterEach(() => {
      container.clearInstances();
      reset(mockedEntryPoints);
    });

    it('should correctly pass update host options from args', async () => {
      const args = {
        project: 'project-id',
        oldHostname: 'old.example.com',
        newHostname: 'new.example.com',
        entrypointIds: ['ep1', 'ep2'],
        token: 'api-token',
        _: [],
        $0: ''
      } as Arguments;

      const expectedTaskId = 'task-123';

      when(processSpy.exit(anything())).thenReturn(undefined);
      when(
        mockedEntryPoints.updateHost(
          objectContaining({
            projectId: 'project-id',
            oldHostname: 'old.example.com',
            newHostname: 'new.example.com',
            entryPointIds: ['ep1', 'ep2']
          })
        )
      ).thenResolve({ taskId: expectedTaskId });

      // Spy on console.log
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await entryPointsUpdateHost.handler(args);

      // Verify console.log was called with the taskId
      expect(consoleLogSpy).toHaveBeenCalledWith(expectedTaskId);

      // Verify logger.error was never called
      verify(loggerSpy.error(anything())).never();

      // Verify process.exit was called with 0 (success)
      verify(processSpy.exit(0)).once();

      // Restore console.log
      consoleLogSpy.mockRestore();
    });

    it('should handle errors correctly', async () => {
      const args = {
        project: 'project-id',
        oldHostname: 'old.example.com',
        newHostname: 'new.example.com',
        token: 'api-token',
        _: [],
        $0: ''
      } as Arguments;

      const error = new Error('Update host failed');

      when(processSpy.exit(anything())).thenReturn(undefined);
      when(mockedEntryPoints.updateHost(anything())).thenReject(error);

      await entryPointsUpdateHost.handler(args);

      // Verify logger.error was called with appropriate error message
      verify(
        loggerSpy.error(
          ErrorMessageFactory.genericCommandError({
            error,
            command: 'entrypoints:update-host'
          })
        )
      ).once();

      // Verify process.exit was called with 1 (error)
      verify(processSpy.exit(1)).once();
    });
  });
});

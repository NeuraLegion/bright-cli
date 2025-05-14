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
  let loggerSpy!: Logger;

  beforeEach(() => {
    loggerSpy = spy(logger);
  });

  afterEach(() => reset(loggerSpy));

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

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await entryPointsUpdateHost.handler(args);

      expect(consoleLogSpy).toHaveBeenCalledWith(expectedTaskId);
      verify(loggerSpy.error(anything())).never();
      expect(process.exitCode).toBe(0);

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

      when(mockedEntryPoints.updateHost(anything())).thenReject(error);

      await entryPointsUpdateHost.handler(args);

      verify(
        loggerSpy.error(
          ErrorMessageFactory.genericCommandError({
            error,
            command: 'entrypoints:update-host'
          })
        )
      ).once();

      expect(process.exitCode).toBe(1);
    });
  });
});

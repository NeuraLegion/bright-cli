import 'reflect-metadata';
import { Logger, logger } from '../Utils';
import { ChangeEntryPointsHost } from './ChangeEntryPointsHost';
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
import yargs from 'yargs/yargs';

describe('ChangeEntryPointsHost', () => {
  let processSpy!: NodeJS.Process;
  let loggerSpy!: Logger;

  beforeEach(() => {
    processSpy = spy(process);
    loggerSpy = spy(logger);
  });

  afterEach(() => reset<NodeJS.Process | Logger>(processSpy, loggerSpy));

  describe('handler', () => {
    let changeEntryPointsHost: ChangeEntryPointsHost;
    const mockedEntryPoints = mock<EntryPoints>();

    beforeEach(() => {
      container.registerInstance(EntryPoints, instance(mockedEntryPoints));
      changeEntryPointsHost = new ChangeEntryPointsHost();
    });

    afterEach(() => {
      container.clearInstances();
      reset(mockedEntryPoints);
    });

    it('should correctly pass config from args', async () => {
      const args = {
        'project': '1',
        'new-host': 'https://new.example.com',
        'old-host': 'https://old.example.com',
        'entrypoint-ids': ['1', '2'],
        '_': [],
        '$0': ''
      } as Arguments;

      when(processSpy.exit(anything())).thenReturn(undefined);
      when(
        mockedEntryPoints.changeHost(
          objectContaining({
            projectId: '1',
            newHost: 'https://new.example.com',
            oldHost: 'https://old.example.com',
            entryPointIds: ['1', '2']
          })
        )
      ).thenResolve();

      await changeEntryPointsHost.handler(args);

      verify(loggerSpy.error(anything())).never();
      verify(loggerSpy.warn(anything())).never();
    });

    it('should handle errors gracefully', async () => {
      const args = {
        'project': '1',
        'new-host': 'https://new.example.com',
        'entrypoint-ids': ['1'],
        '_': [],
        '$0': ''
      } as Arguments;

      const error = new Error('API Error');
      when(processSpy.exit(anything())).thenReturn(undefined);
      when(mockedEntryPoints.changeHost(anything())).thenReject(error);

      await changeEntryPointsHost.handler(args);

      verify(loggerSpy.error(anything())).once();
    });
  });

  describe('builder', () => {
    let yargsInstance: any;
    let changeEntryPointsHost: ChangeEntryPointsHost;

    beforeEach(() => {
      yargsInstance = yargs([]).exitProcess(false).strict(false);
      changeEntryPointsHost = new ChangeEntryPointsHost();
    });

    it('should configure options correctly', () => {
      const argv = [
        '--token',
        'test-token',
        '--project',
        'test-project',
        '--new-host',
        'https://new.example.com',
        '--entrypoint-ids',
        '1',
        '2'
      ];

      const result = changeEntryPointsHost.builder(yargsInstance);
      expect(() => result.parse(argv)).not.toThrow();
    });

    it('should require new-host and project options', () => {
      const argv = ['--token', 'test-token'];

      const result = changeEntryPointsHost.builder(yargsInstance);
      expect(() => result.parse(argv)).toThrow();
    });
  });
});

import 'reflect-metadata';
import { Logger, logger } from '../Utils';
import { GetEntryPoints } from './GetEntryPoints';
import { EntryPoints } from '../EntryPoint';
import { mock, reset, spy, instance, when, anything, verify } from 'ts-mockito';
import { container } from 'tsyringe';
import { Arguments } from 'yargs';

describe('GetEntryPoints', () => {
  let processSpy!: NodeJS.Process;
  let loggerSpy!: Logger;

  beforeEach(() => {
    processSpy = spy(process);
    loggerSpy = spy(logger);
  });

  afterEach(() => reset<NodeJS.Process | Logger>(processSpy, loggerSpy));

  describe('handler', () => {
    let getEntryPoints: GetEntryPoints;
    const mockedEntryPoints = mock<EntryPoints>();

    beforeEach(() => {
      container.registerInstance(EntryPoints, instance(mockedEntryPoints));
      getEntryPoints = new GetEntryPoints();
    });

    afterEach(() => {
      container.clearInstances();
      reset(mockedEntryPoints);
    });

    it('should correctly pass config from args', async () => {
      const args = {
        project: '1',
        verbose: true,
        _: [],
        $0: ''
      } as Arguments;

      when(processSpy.exit(anything())).thenReturn(undefined);

      await getEntryPoints.handler(args);

      verify(processSpy.exit(0)).once();
      verify(loggerSpy.error(anything())).never();
      verify(loggerSpy.warn(anything())).never();
    });
  });
});

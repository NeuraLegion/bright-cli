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
      when(mockedEntryPoints.entrypoints('1')).thenResolve([
        {
          id: '1',
          method: 'GET',
          url: 'http://example.com',
          responseStatus: 200,
          connectivity: 'CONNECTED',
          responseTime: 100,
          lastUpdated: '2021-11-01T00:00:00Z',
          lastEdited: '2021-11-01T00:00:00Z',
          lastValidated: '2021-11-01T00:00:00Z',
          parametersCount: 0,
          status: 'OPEN',
          openIssuesCount: 0,
          closedIssuesCount: 0,
          createdAt: '2021-01-01T00:00:00Z'
        }
      ]);

      await getEntryPoints.handler(args);

      verify(loggerSpy.error(anything())).never();
      verify(loggerSpy.warn(anything())).never();
    });
  });
});

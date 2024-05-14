import 'reflect-metadata';
import { Logger, logger } from '../Utils';
import { RunScan } from './RunScan';
import {
  AttackParamLocation,
  Exclusions,
  Module,
  Scans,
  ScanWarning,
  TestType
} from '../Scan';
import {
  anything,
  instance,
  mock,
  objectContaining,
  reset,
  spy,
  verify,
  when
} from 'ts-mockito';
import { container } from 'tsyringe';
import { Arguments } from 'yargs';

describe('RunScan', () => {
  let processSpy!: NodeJS.Process;
  let loggerSpy!: Logger;

  beforeEach(() => {
    processSpy = spy(process);
    loggerSpy = spy(logger);
  });

  afterEach(() => reset<NodeJS.Process | Logger>(processSpy, loggerSpy));

  describe('excludeEntryPoint', () => {
    it('should return list of unique methods and patterns', () => {
      // arrange
      const input = [
        JSON.stringify({
          methods: ['POST', 'POST', 'GET'],
          patterns: ['www.example.com', 'www.example.com', 'www.foo.bar']
        })
      ];

      // act
      const result = RunScan.excludeEntryPoint(input);

      // assert
      expect(result).toEqual([
        {
          methods: ['POST', 'GET'],
          patterns: ['www.example.com', 'www.foo.bar']
        }
      ]);
    });

    it('should print an error message and exit if patterns contain only empty strings', () => {
      // arrange
      const input = [JSON.stringify({ patterns: [''] })];

      // ADHOC: due to the bug in ts-mockito an undefined value has to be passed
      when(processSpy.exit(anything())).thenReturn(undefined);
      when(loggerSpy.error(anything())).thenReturn();

      // act
      RunScan.excludeEntryPoint(input);

      // assert
      verify(processSpy.exit(1)).once();
      verify(
        loggerSpy.error(
          'Error during "scan:run": please make sure that patterns contain at least one regexp.'
        )
      ).once();
    });

    it('should throw an error if patterns is invalid JSON', () => {
      // arrange
      const input = [`{ 'patterns': ['] }`];

      // act
      const act = () => RunScan.excludeEntryPoint(input);

      // assert
      expect(act).toThrowError(SyntaxError);
    });
  });

  describe('handler', () => {
    const runScan = new RunScan();
    const mockedRestScans = mock<Scans>();

    beforeEach(() => {
      container.registerInstance(Scans, instance(mockedRestScans));
    });

    afterEach(() => {
      container.clearInstances();
      reset(mockedRestScans);
    });

    it('should correctly pass scan config from args', async () => {
      // arrange
      const args = {
        test: ['test1', 'test2'],
        name: 'test-scan',
        module: 'test-module',
        auth: 'test-auth',
        project: 'test-project',
        template: 'test-template',
        bucket: ['test-bucket'],
        hostFilter: ['test-host'],
        header: ['header1', 'header2'],
        crawler: ['test-crawler'],
        archive: 'test-archive',
        repeater: ['test-repeater'],
        smart: true,
        param: ['param1', 'param2'],
        excludeEntryPoint: ['exclude-entry-point'],
        excludeParam: ['exclude-param'],
        _: [],
        $0: ''
      } as Arguments;

      when(processSpy.exit(anything())).thenReturn(undefined);
      when(
        mockedRestScans.create(
          objectContaining({
            tests: args.test as TestType[],
            name: args.name as string,
            module: args.module as Module,
            authObjectId: args.auth as string,
            projectId: args.project as string,
            templateId: args.template as string,
            buckets: args.bucket as string[],
            hostsFilter: args.hostFilter as string[],
            crawlerUrls: args.crawler as string[],
            fileId: args.archive as string,
            repeaters: args.repeater as string[],
            smart: args.smart as boolean,
            attackParamLocations: args.param as AttackParamLocation[],
            exclusions: {
              requests: args.excludeEntryPoint,
              params: args.excludeParam
            } as Exclusions
          })
        )
      ).thenResolve({ id: 'test-scan-id', warnings: [] });

      // act
      await runScan.handler(args);

      // assert
      verify(processSpy.exit(0)).once();
      verify(loggerSpy.error(anything())).never();
      verify(loggerSpy.warn(anything())).never();
    });

    it('should throw an error on create request fall', async () => {
      // arrange
      const args = {
        name: 'test-scan',
        _: [],
        $0: ''
      } as Arguments;
      const errMessage = 'request error';

      when(processSpy.exit(anything())).thenReturn(undefined);
      when(
        mockedRestScans.create(
          objectContaining({
            name: args.name as string
          })
        )
      ).thenReject(new Error(errMessage));

      // act
      await runScan.handler(args);

      // assert
      verify(processSpy.exit(1)).once();
      verify(loggerSpy.error(`Error during "scan:run": ${errMessage}`)).once();
    });

    it('should display warnings when present', async () => {
      // arrange
      const args = {
        name: 'test-scan',
        _: [],
        $0: ''
      } as Arguments;

      const warnings: ScanWarning[] = [
        { message: 'Warning message 1', code: '123' },
        { message: 'Warning message 2', code: '124' }
      ];

      when(processSpy.exit(anything())).thenReturn(undefined);
      when(mockedRestScans.create(anything())).thenResolve({
        id: 'test-scan-id',
        warnings
      });

      // act
      await runScan.handler(args);

      // assert
      verify(processSpy.exit(0)).once();
      verify(loggerSpy.warn('Warning message 1\nWarning message 2\n')).once();
    });
  });
});

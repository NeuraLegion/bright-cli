import 'reflect-metadata';
import { Logger, logger } from '../Utils';
import { RunScan } from './RunScan';
import {
  AttackParamLocation,
  Exclusions,
  Module,
  Scans,
  ScanWarning
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
import yargs from 'yargs/yargs';

describe('RunScan', () => {
  let processSpy!: NodeJS.Process;
  let loggerSpy!: Logger;

  beforeEach(() => {
    processSpy = spy(process);
    loggerSpy = spy(logger);
  });

  afterEach(() => reset<NodeJS.Process | Logger>(processSpy, loggerSpy));

  describe('command validation', () => {
    let runScan: RunScan;
    let yargsInstance: any;

    beforeEach(() => {
      runScan = new RunScan();
      yargsInstance = yargs([])
        .exitProcess(false) // Prevent yargs from calling process.exit()
        .strict(false); // Don't enforce strict mode for testing
    });

    it('should throw error when entrypoint is used with archive', () => {
      // arrange
      const argv = [
        '--token',
        'test-token',
        '--name',
        'test-scan',
        '--entrypoint',
        'test-entry',
        '--archive',
        'test.har'
      ];

      // act & assert
      expect(() => runScan.builder(yargsInstance).parse(argv)).toThrow(
        'Arguments entrypoint and archive are mutually exclusive'
      );
    });

    it('should throw error when entrypoint is used with crawler', () => {
      // arrange
      const argv = [
        '--token',
        'test-token',
        '--name',
        'test-scan',
        '--entrypoint',
        'test-entry',
        '--crawler',
        'http://example.com'
      ];

      // act & assert
      expect(() => runScan.builder(yargsInstance).parse(argv)).toThrow(
        'Arguments entrypoint and crawler are mutually exclusive'
      );
    });

    it('should throw error when neither entrypoint, archive, nor crawler is specified', () => {
      // arrange
      const argv = ['--token', 'test-token', '--name', 'test-scan'];

      // act & assert
      expect(() => runScan.builder(yargsInstance).parse(argv)).toThrow(
        'When --entrypoint is not provided, either --archive or --crawler must be specified'
      );
    });

    it('should not throw when only entrypoint is specified', () => {
      // arrange
      const argv = [
        '--token',
        'test-token',
        '--name',
        'test-scan',
        '--entrypoint',
        'test-entry'
      ];

      // act & assert
      expect(() => runScan.builder(yargsInstance).parse(argv)).not.toThrow();
    });

    it('should not throw when only archive is specified', () => {
      // arrange
      const argv = [
        '--token',
        'test-token',
        '--name',
        'test-scan',
        '--archive',
        'test.har'
      ];

      // act & assert
      expect(() => runScan.builder(yargsInstance).parse(argv)).not.toThrow();
    });

    it('should not throw when only crawler is specified', () => {
      // arrange
      const argv = [
        '--token',
        'test-token',
        '--name',
        'test-scan',
        '--crawler',
        'http://example.com'
      ];

      // act & assert
      expect(() => runScan.builder(yargsInstance).parse(argv)).not.toThrow();
    });
  });

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
    let runScan!: RunScan;
    const mockedScans = mock<Scans>();

    beforeEach(() => {
      container.registerInstance(Scans, instance(mockedScans));
      runScan = new RunScan();
    });

    afterEach(() => {
      container.clearInstances();
      reset(mockedScans);
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
        mockedScans.create(
          objectContaining({
            tests: args.test as string[],
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
        mockedScans.create(
          objectContaining({
            name: args.name as string
          })
        )
      ).thenReject(new Error(errMessage));

      // act
      await runScan.handler(args);

      // assert
      verify(processSpy.exit(1)).once();
      verify(loggerSpy.error(`Error during "scan:run": ${errMessage}.`)).once();
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
      when(mockedScans.create(anything())).thenResolve({
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

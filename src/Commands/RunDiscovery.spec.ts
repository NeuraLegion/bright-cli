import 'reflect-metadata';
import { Logger, logger } from '../Utils';
import { RunDiscovery } from './RunDiscovery';
import { Discoveries } from '../Discovery';
import { instance, mock, reset, spy, when } from 'ts-mockito';
import { container } from 'tsyringe';
import yargs from 'yargs/yargs';

describe('RunDiscovery', () => {
  let processSpy!: NodeJS.Process;
  let loggerSpy!: Logger;

  beforeEach(() => {
    processSpy = spy(process);
    loggerSpy = spy(logger);
  });

  afterEach(() => reset<NodeJS.Process | Logger>(processSpy, loggerSpy));

  describe('command validation', () => {
    let runDiscovery: RunDiscovery;
    let yargsInstance: any;

    beforeEach(() => {
      runDiscovery = new RunDiscovery();
      yargsInstance = yargs([])
        .exitProcess(false) // Prevent yargs from calling process.exit()
        .strict(false); // Don't enforce strict mode for testing
    });

    it('should throw error when neither archive nor crawler is specified', () => {
      // arrange
      const argv = [
        '--token',
        'test-token',
        '--name',
        'test-discovery',
        '--project',
        'test-project'
      ];

      // act & assert
      expect(() => runDiscovery.builder(yargsInstance).parse(argv)).toThrow(
        'Either --archive or --crawler must be specified'
      );
    });

    it('should throw error when both archive and crawler are specified', () => {
      // arrange
      const argv = [
        '--token',
        'test-token',
        '--name',
        'test-discovery',
        '--project',
        'test-project',
        '--archive',
        'test.har',
        '--crawler',
        'http://example.com'
      ];

      // act & assert
      expect(() => runDiscovery.builder(yargsInstance).parse(argv)).toThrow(
        'Arguments archive and crawler are mutually exclusive'
      );
    });

    it('should not throw when only archive is specified', () => {
      // arrange
      const argv = [
        '--token',
        'test-token',
        '--name',
        'test-discovery',
        '--project',
        'test-project',
        '--archive',
        'test.har'
      ];

      // act & assert
      expect(() =>
        runDiscovery.builder(yargsInstance).parse(argv)
      ).not.toThrow();
    });

    it('should not throw when only crawler is specified', () => {
      // arrange
      const argv = [
        '--token',
        'test-token',
        '--name',
        'test-discovery',
        '--project',
        'test-project',
        '--crawler',
        'http://example.com'
      ];

      // act & assert
      expect(() =>
        runDiscovery.builder(yargsInstance).parse(argv)
      ).not.toThrow();
    });
  });
});

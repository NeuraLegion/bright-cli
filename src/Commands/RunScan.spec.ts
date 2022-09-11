import 'reflect-metadata';
import { Logger, logger } from '../Utils';
import { RunScan } from './RunScan';
import { anything, reset, spy, verify, when } from 'ts-mockito';

describe('RunScan', () => {
  let sut!: RunScan;
  let processSpy: NodeJS.Process;
  let loggerSpy: Logger;

  beforeEach(() => {
    sut = new RunScan();
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
      const result = sut.excludeEntryPoint(input);

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

      when(processSpy.exit(anything())).thenReturn(undefined);
      when(loggerSpy.error(anything())).thenReturn(undefined);

      // act
      sut.excludeEntryPoint(input);

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
      const act = () => sut.excludeEntryPoint(input);

      // assert
      expect(act).toThrowError(SyntaxError);
      expect(act).toThrowError(`Unexpected token ' in JSON at position 2`);
    });
  });
});

import 'reflect-metadata';
import { logger } from '../Utils';
import { RunScan } from './RunScan';
import { anything, spy, verify, when } from 'ts-mockito';

describe('RunScan', () => {
  let sut!: RunScan;

  beforeEach(() => {
    sut = new RunScan();
  });

  describe('excludeEntryPointCoerce', () => {
    it('should return lists of unique methods and patterns', () => {
      // arrange
      const input = [
        JSON.stringify({
          methods: ['POST', 'POST', 'GET'],
          patterns: ['www.example.com', 'www.example.com', 'www.foo.bar']
        })
      ];

      // act
      const result = sut.excludeEntryPointCoerce(input);

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
      const processSpy = spy(process);
      const loggerSpy = spy(logger);

      when(processSpy.exit(anything())).thenResolve();
      when(loggerSpy.error(anything())).thenResolve();

      // act
      sut.excludeEntryPointCoerce(input);

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
      const act = () => sut.excludeEntryPointCoerce(input);

      // assert
      expect(act).toThrowError(SyntaxError);
      expect(act).toThrowError(`Unexpected token ' in JSON at position 2`);
    });
  });
});

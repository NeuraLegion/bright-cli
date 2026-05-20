import 'reflect-metadata';
import { HeadersBuilder } from './HeadersBuilder';
import { MalformedHeaderLine } from './Request';

describe('HeadersBuilder', () => {
  let sut: HeadersBuilder;

  beforeEach(() => {
    sut = new HeadersBuilder();
  });

  describe('build', () => {
    it.each([
      { desc: 'undefined', malformedHeaderLines: undefined },
      {
        desc: 'an empty array',
        malformedHeaderLines: [] as MalformedHeaderLine[]
      }
    ])(
      'should return plain headers when malformedHeaderLines is $desc',
      ({ malformedHeaderLines }) => {
        // arrange
        const headers = { accept: 'application/json' };

        // act
        const result = sut.build({ headers, malformedHeaderLines });

        // assert
        expect(result).toEqual(['accept: application/json']);
      }
    );

    it('should expand an array header value into multiple lines', () => {
      // arrange
      const headers = { 'x-custom': ['value1', 'value2'] };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 99, line: ';trailing' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result).toContain('x-custom: value1');
      expect(result).toContain('x-custom: value2');
    });

    it('should render a header with an undefined value as "key: "', () => {
      // arrange
      const headers = { 'x-empty': undefined as unknown as string };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 99, line: ';trailing' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result).toContain('x-empty: ');
    });

    it('should skip header entries with an empty key', () => {
      // arrange
      const headers = { '': 'should-be-skipped', 'accept': 'text/html' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 99, line: ';trailing' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result?.some((l) => l.startsWith(': '))).toBe(false);
      expect(result).toContain('accept: text/html');
    });

    it('should return only the malformed line when headers is falsy', () => {
      // arrange
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 0, line: ';only-raw' }
      ];

      // act
      const result = sut.build({
        headers: null as unknown as Record<string, string>,
        malformedHeaderLines
      });

      // assert
      expect(result).toEqual([';only-raw']);
    });

    it('should insert a malformed line at index 0 before all clean headers', () => {
      // arrange
      const headers = { accept: 'application/json', host: 'example.com' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 0, line: ';at-start' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result[0]).toBe(';at-start');
    });

    it('should insert a malformed line between two clean headers', () => {
      // arrange
      const headers = { accept: 'application/json', host: 'example.com' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 1, line: ';in-middle' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      const acceptIdx = result.indexOf('accept: application/json');
      const rawIdx = result.indexOf(';in-middle');
      const hostIdx = result.indexOf('host: example.com');

      expect(rawIdx).toBeGreaterThan(acceptIdx);
      expect(rawIdx).toBeLessThan(hostIdx);
    });

    it('should append a malformed line with an out-of-range index at the end', () => {
      // arrange
      const headers = { accept: 'application/json', host: 'example.com' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 99, line: ';at-end' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result.at(-1)).toBe(';at-end');
    });

    it('should insert multiple malformed lines at correct positions even when provided out of order', () => {
      // arrange
      // Resulting layout: ;first(0), accept(1), ;second(2), host(3)
      const headers = { accept: 'application/json', host: 'example.com' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 2, line: ';second' },
        { index: 0, line: ';first' } // provided out of order to exercise sort
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      const firstIdx = result.indexOf(';first');
      const acceptIdx = result.indexOf('accept: application/json');
      const secondIdx = result.indexOf(';second');
      const hostIdx = result.indexOf('host: example.com');

      expect(firstIdx).toBeLessThan(acceptIdx);
      expect(secondIdx).toBeGreaterThan(acceptIdx);
      expect(secondIdx).toBeLessThan(hostIdx);
    });

    it('should insert consecutive malformed lines at adjacent indices in order', () => {
      // arrange
      // Resulting layout: host(0), ;lineA(1), ;lineB(2), accept(3)
      const headers = { host: 'example.com', accept: 'text/html' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 1, line: ';lineA' },
        { index: 2, line: ';lineB' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      const idxA = result.indexOf(';lineA');
      const idxB = result.indexOf(';lineB');
      const acceptIdx = result.indexOf('accept: text/html');

      expect(idxA).toBeLessThan(idxB);
      expect(idxA).toBeLessThan(acceptIdx);
      expect(idxB).toBeLessThan(acceptIdx);
    });

    it('should preserve all clean headers alongside malformed lines', () => {
      // arrange
      const headers = {
        'accept': 'application/json',
        'user-agent': 'test',
        'host': 'example.com'
      };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 1, line: ';injected' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result).toContain('accept: application/json');
      expect(result).toContain('user-agent: test');
      expect(result).toContain('host: example.com');
      expect(result).toContain(';injected');
      expect(result).toHaveLength(4);
    });

    it('should place a malformed line correctly when headers is an empty object', () => {
      // arrange
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 0, line: ';only-raw' }
      ];

      // act
      const result = sut.build({ headers: {}, malformedHeaderLines });

      // assert
      expect(result).toEqual([';only-raw']);
    });
  });
});

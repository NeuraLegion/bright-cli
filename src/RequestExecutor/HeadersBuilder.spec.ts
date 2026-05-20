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

      // act
      const result = sut.build({ headers });

      // assert
      expect(result).toContain('x-custom: value1');
      expect(result).toContain('x-custom: value2');
    });

    it('should render a header with an undefined value as "key: "', () => {
      // arrange
      const headers = { 'x-empty': undefined as unknown as string };

      // act
      const result = sut.build({ headers });

      // assert
      expect(result).toContain('x-empty: ');
    });

    it('should skip header entries with an empty key', () => {
      // arrange
      const headers = { '': 'should-be-skipped', 'accept': 'text/html' };

      // act
      const result = sut.build({ headers });

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
      // The colon-less line is folded into the preceding header entry via \r\n
      const foldedEntry = 'accept: application/json\r\n;in-middle';
      expect(result).toContain(foldedEntry);
      expect(result).toContain('host: example.com');
      expect(result.indexOf(foldedEntry)).toBeLessThan(
        result.indexOf('host: example.com')
      );
    });

    it('should append a malformed line with an out-of-range index folded into the last header', () => {
      // arrange
      const headers = { accept: 'application/json', host: 'example.com' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 99, line: ';at-end' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      // Appended after all entries → folds into the last clean header
      expect(result.at(-1)).toBe('host: example.com\r\n;at-end');
    });

    it('should insert multiple malformed lines at correct positions even when provided out of order', () => {
      // arrange
      // Logical layout before folding: ;first(0), accept(1), ;second(2), host(3)
      // After folding: ;first stays (no preceding entry), ;second folds into accept
      const headers = { accept: 'application/json', host: 'example.com' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 2, line: ';second' },
        { index: 0, line: ';first' } // provided out of order to exercise sort
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result[0]).toBe(';first');
      expect(result).toContain('accept: application/json\r\n;second');
      expect(result).toContain('host: example.com');
      expect(result.indexOf(';first')).toBeLessThan(
        result.indexOf('accept: application/json\r\n;second')
      );
    });

    it('should insert consecutive malformed lines at adjacent indices in order', () => {
      // arrange
      // Logical layout before folding: host(0), ;lineA(1), ;lineB(2), accept(3)
      // After folding: both colon-less lines fold into host consecutively
      const headers = { host: 'example.com', accept: 'text/html' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 1, line: ';lineA' },
        { index: 2, line: ';lineB' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result[0]).toBe('host: example.com\r\n;lineA\r\n;lineB');
      expect(result[1]).toBe('accept: text/html');
      expect(result).toHaveLength(2);
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
      // ;injected folds into accept, reducing the total entry count by 1
      expect(result).toContain('accept: application/json\r\n;injected');
      expect(result).toContain('user-agent: test');
      expect(result).toContain('host: example.com');
      expect(result).toHaveLength(3);
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

  describe('foldColonlessHeaders behavior', () => {
    it('should fold a colon-less line into the preceding header via \\r\\n', () => {
      // arrange
      const headers = { accept: 'application/json', host: 'example.com' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 1, line: ';no-colon' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result).toContain('accept: application/json\r\n;no-colon');
      expect(result).not.toContain(';no-colon');
    });

    it('should leave a colon-less line at index 0 as-is when there is no preceding entry', () => {
      // arrange
      const headers = { host: 'example.com' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 0, line: ';leading' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result[0]).toBe(';leading');
      expect(result[1]).toBe('host: example.com');
    });

    it('should fold multiple consecutive colon-less lines into a single preceding entry', () => {
      // arrange
      const headers = { accept: 'text/html' };
      const malformedHeaderLines: MalformedHeaderLine[] = [
        { index: 1, line: ';first' },
        { index: 2, line: ';second' }
      ];

      // act
      const result = sut.build({ headers, malformedHeaderLines });

      // assert
      expect(result).toEqual(['accept: text/html\r\n;first\r\n;second']);
    });

    it('should not alter entries that already contain a colon', () => {
      // arrange
      const headers = { accept: 'application/json', host: 'example.com' };

      // act
      const result = sut.build({ headers });

      // assert
      expect(result).toEqual(['accept: application/json', 'host: example.com']);
    });
  });
});

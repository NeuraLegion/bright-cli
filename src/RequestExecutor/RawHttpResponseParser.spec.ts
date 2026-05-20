import { RawHttpResponseParser } from './RawHttpResponseParser';

const parser = new RawHttpResponseParser();

function makeRaw(statusLine: string, headers: string[], body?: string): Buffer {
  const head = [statusLine, ...headers].join('\r\n');
  const bodyStr = body ?? '';

  return Buffer.from(`${head}\r\n\r\n${bodyStr}`, 'latin1');
}

describe('RawHttpResponseParser', () => {
  describe('parse', () => {
    describe('status code', () => {
      it.each([
        { statusLine: 'HTTP/1.1 200 OK', expected: 200 },
        { statusLine: 'HTTP/1.1 404 Not Found', expected: 404 },
        { statusLine: 'HTTP/1.0 500 Internal Server Error', expected: 500 },
        { statusLine: 'HTTP/1.1 204 No Content', expected: 204 }
      ])(
        'should parse $expected from "$statusLine"',
        ({ statusLine, expected }) => {
          const raw = makeRaw(statusLine, ['content-length: 0']);

          const result = parser.parse(raw, 0);

          expect(result.statusCode).toBe(expected);
        }
      );

      it('should return 0 when status line is malformed', () => {
        const raw = Buffer.from('GARBAGE\r\n\r\n', 'latin1');

        const result = parser.parse(raw, 0);

        expect(result.statusCode).toBe(0);
      });
    });

    describe('headers', () => {
      it('should parse a single header', () => {
        const raw = makeRaw('HTTP/1.1 200 OK', ['content-type: text/html']);

        const result = parser.parse(raw, 0);

        expect(result.headers['content-type']).toBe('text/html');
      });

      it('should lower-case header names', () => {
        const raw = makeRaw('HTTP/1.1 200 OK', [
          'Content-Type: application/json'
        ]);

        const result = parser.parse(raw, 0);

        expect(result.headers['content-type']).toBe('application/json');
      });

      it('should trim whitespace from header values', () => {
        const raw = makeRaw('HTTP/1.1 200 OK', ['x-custom:   spaced value  ']);

        const result = parser.parse(raw, 0);

        expect(result.headers['x-custom']).toBe('spaced value');
      });

      it('should collect duplicate header names into an array', () => {
        const raw = makeRaw('HTTP/1.1 200 OK', [
          'set-cookie: a=1',
          'set-cookie: b=2'
        ]);

        const result = parser.parse(raw, 0);

        expect(result.headers['set-cookie']).toEqual(['a=1', 'b=2']);
      });

      it('should collect three or more duplicate header names into an array', () => {
        const raw = makeRaw('HTTP/1.1 200 OK', [
          'set-cookie: a=1',
          'set-cookie: b=2',
          'set-cookie: c=3'
        ]);

        const result = parser.parse(raw, 0);

        expect(result.headers['set-cookie']).toEqual(['a=1', 'b=2', 'c=3']);
      });

      it('should skip malformed header lines silently', () => {
        const raw = makeRaw('HTTP/1.1 200 OK', [
          'valid: yes',
          'no-colon-here',
          'also-valid: ok'
        ]);

        const result = parser.parse(raw, 0);

        expect(result.headers['valid']).toBe('yes');
        expect(result.headers['also-valid']).toBe('ok');
        expect(Object.keys(result.headers)).toHaveLength(2);
      });
    });

    describe('body', () => {
      it('should extract the body', () => {
        const raw = makeRaw('HTTP/1.1 200 OK', ['content-length: 5'], 'hello');

        const result = parser.parse(raw, 0);

        expect(result.rawBody.toString()).toBe('hello');
      });

      it('should clip body to content-length when buffer has trailing bytes', () => {
        const raw = makeRaw('HTTP/1.1 200 OK', ['content-length: 3'], 'hello');

        const result = parser.parse(raw, 0);

        expect(result.rawBody.toString()).toBe('hel');
      });

      it('should return the full body when content-length is absent', () => {
        const raw = makeRaw('HTTP/1.1 200 OK', [], 'no-length-body');

        const result = parser.parse(raw, 0);

        expect(result.rawBody.toString()).toBe('no-length-body');
      });

      it('should return an empty buffer when no header separator is present', () => {
        const raw = Buffer.from(
          'HTTP/1.1 200 OK\r\nContent-Length: 5',
          'latin1'
        );

        const result = parser.parse(raw, 0);

        expect(result.rawBody).toEqual(Buffer.alloc(0));
      });

      it('should return an empty buffer when content-length is 0', () => {
        const raw = makeRaw('HTTP/1.1 204 No Content', ['content-length: 0']);

        const result = parser.parse(raw, 0);

        expect(result.rawBody.byteLength).toBe(0);
      });
    });

    describe('ttfb', () => {
      it('should pass ttfb through unchanged', () => {
        const raw = makeRaw('HTTP/1.1 200 OK', ['content-length: 0']);

        const result = parser.parse(raw, 42);

        expect(result.ttfb).toBe(42);
      });
    });
  });
});

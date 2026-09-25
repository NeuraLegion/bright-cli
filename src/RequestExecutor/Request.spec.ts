import 'reflect-metadata';
import type { Request as RequestInterface } from './Request';
import { Protocol } from './Protocol';
import fs from 'node:fs';

describe('Request', () => {
  let readFileMock!: jest.Mock;
  let Request!: typeof RequestInterface;
  const certContent = Buffer.from([]);

  beforeEach(async () => {
    readFileMock = jest.fn();
    jest.doMock('node:fs/promises', () => ({ ...fs, readFile: readFileMock }));
    // ADHOC: `jest.doMock` must be called before importing SUT
    Request = (await import('./Request')).Request;
  });

  afterEach(() => {
    jest.resetModules();
    readFileMock.mockReset();
  });

  describe('loadCert', () => {
    it.each(['https://foo.bar', 'wss://foo.bar'])(
      'should read cert for url %s if there was matching certificate configured globally',
      async (url) => {
        //arrange
        const cert = {
          path: '~/cert.pfx',
          hostname: 'foo.bar'
        };
        const request = new Request({
          url,
          headers: {},
          protocol: Protocol.HTTP
        });
        //arrange:mock
        readFileMock.mockImplementation((filePath) =>
          filePath === cert.path
            ? Promise.resolve(certContent)
            : Promise.reject(new Error('no such file'))
        );
        //act
        await request.loadCert(cert);
        //assert
        expect(request.pfx).toBeTruthy();
      }
    );
  });

  describe('setHeaders', () => {
    it('should append headers', () => {
      const request = new Request({
        url: 'http://foo.bar',
        headers: { 'x-key': 'value' },
        protocol: Protocol.HTTP
      });

      request.setHeaders({ 'x-a1': 'a1', 'x-a2': 'a2' });

      expect(request.headers).toEqual({
        'x-key': 'value',
        'x-a1': 'a1',
        'x-a2': 'a2'
      });
    });

    it('should join headers if multiple values is present', () => {
      const request = new Request({
        url: 'http://foo.bar',
        protocol: Protocol.HTTP
      });

      request.setHeaders({ host: ['example.com', 'example1.com'] });

      expect(request.headers).toEqual({
        host: 'example.com, example1.com'
      });
    });
  });

  describe('constructor', () => {
    // The six authority shapes the WHATWG parser (old new URL() predicate)
    // rejected. bridges accepts them and dispatches them, so the CLI must too —
    // they now construct successfully and are answered by libcurl downstream.
    const previouslyRejected = [
      'http://host:notaport/',
      'http://host:99999/',
      'http://::1/',
      'http://ho st/',
      'http://[not-ipv6]/',
      'http://user@host name/'
    ];

    it.each(previouslyRejected)(
      'should accept the previously-rejected authority shape %s',
      (url) => {
        expect(
          () => new Request({ url, protocol: Protocol.HTTP })
        ).not.toThrow();
      }
    );

    it('should trim and store the url', () => {
      const request = new Request({
        url: '  http://foo.bar/x  ',
        protocol: Protocol.HTTP
      });

      expect(request.url).toBe('http://foo.bar/x');
    });

    it('should still reject an empty url', () => {
      expect(() => new Request({ url: '', protocol: Protocol.HTTP })).toThrow(
        /Invalid URL/
      );
    });

    it('should still reject a whitespace-only url', () => {
      expect(
        () => new Request({ url: '   ', protocol: Protocol.HTTP })
      ).toThrow(/Invalid URL/);
    });

    it('should carry the offending value on the rejection message', () => {
      // A blank url is the only surviving rejection; its (empty) value is named.
      expect(() => new Request({ url: '', protocol: Protocol.HTTP })).toThrow(
        'Invalid URL: '
      );
    });

    it('should build the rejection message through the userinfo-redacting formatter', () => {
      // The only surviving rejection is a blank-after-trim url, so the offending
      // value is empty here; the credential-redaction guarantee itself is proven
      // in TargetUrl.spec (redact). This pins that the message is produced via
      // that redacting formatter rather than interpolating a raw url, so a
      // future non-blank rejection could never leak userinfo to Sentry.
      expect(() => new Request({ url: '', protocol: Protocol.HTTP })).toThrow(
        'Invalid URL: '
      );
    });

    it('should accept a credentialed url without leaking it (no rejection path)', () => {
      expect(
        () =>
          new Request({
            url: 'http://user:pass@host/',
            protocol: Protocol.HTTP
          })
      ).not.toThrow();
    });
  });
});

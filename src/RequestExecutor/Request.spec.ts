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

  describe('setCerts', () => {
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
        await request.setCerts([cert]);
        //assert
        expect(request.pfx).toBeTruthy();
      }
    );

    it.each(['https://foo.bar', 'wss://foo.bar'])(
      'should not read cert for url %s if there was no matching by hostname',
      async (url) => {
        //arrange
        const cert = {
          path: '~/cert.pfx',
          hostname: 'not-a-foo.bar'
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
        await request.setCerts([cert]);
        //assert
        expect(request.pfx).toBeUndefined();
      }
    );

    it.each([
      { url: 'https://foo.bar', wildcard: '*.bar' },
      { url: 'wss://foo.bar', wildcard: '*.bar' }
    ])(
      'should read cert for url $url if there was wildcard hostname match',
      async ({ url, wildcard }) => {
        //arrange
        const cert = {
          path: '~/cert.pfx',
          hostname: wildcard
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
        await request.setCerts([cert]);
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

    it('should load different certs per matching port', async () => {
      const request1 = new Request({
        url: 'https://foo.bar:8080',
        protocol: Protocol.HTTP
      });

      const request2 = new Request({
        url: 'https://foo.bar:1234',
        protocol: Protocol.HTTP
      });

      const cert1 = {
        path: '~/cert1.pfx',
        hostname: 'foo.bar',
        port: '8080'
      };

      const cert2 = {
        path: '~/cert2.pfx',
        hostname: 'foo.bar',
        port: '1234'
      };

      const cert1Content = Buffer.from('cert1', 'utf8');
      const cert2Content = Buffer.from('cert2', 'utf8');

      //arrange:mock
      readFileMock.mockImplementation((filePath) => {
        switch (filePath) {
          case cert1.path:
            return Promise.resolve(cert1Content);
          case cert2.path:
            return Promise.resolve(cert2Content);
          default:
            return Promise.reject(new Error('no such file'));
        }
      });

      //act
      await request1.setCerts([cert1, cert2]);
      await request2.setCerts([cert1, cert2]);

      //assert
      expect(request1.pfx).toBeTruthy();
      expect(request1.pfx).toEqual(cert1Content);

      expect(request2.pfx).toBeTruthy();
      expect(request2.pfx).toEqual(cert2Content);
    });
  });
});

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

  describe('setCert', () => {
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
        await request.setCert(cert);
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
});

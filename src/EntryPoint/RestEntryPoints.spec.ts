import 'reflect-metadata';
import { RestEntryPoints } from './RestEntryPoints';
import { ProxyFactory } from '../Utils';
import { instance, mock } from 'ts-mockito';
import nock from 'nock';

describe('RestEntryPoints', () => {
  const proxyFactoryMock = mock<ProxyFactory>();

  let restEntryPoints!: RestEntryPoints;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(() => {
    if (!nock.isActive()) {
      nock.activate();
    }

    restEntryPoints = new RestEntryPoints(instance(proxyFactoryMock), {
      baseURL: 'https://example.com/',
      apiKey: 'key'
    });
  });

  afterEach(() => {
    nock.cleanAll();
    nock.restore();
  });

  afterAll(() => nock.enableNetConnect());

  describe('entrypoints', () => {
    it('should return entrypoints', async () => {
      nock('https://example.com')
        .get('/api/v2/projects/1/entry-points')
        .reply(200, { items: [{ id: 1, name: 'entrypoint1' }] });

      const result = await restEntryPoints.entrypoints('1');

      expect(result).toEqual([{ id: 1, name: 'entrypoint1' }]);
    });
  });
});

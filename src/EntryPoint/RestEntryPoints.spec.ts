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
        .get('/api/v2/projects/1/entry-points?limit=10')
        .reply(200, { items: [{ id: 1, name: 'entrypoint1' }] });

      const result = await restEntryPoints.entrypoints({
        projectId: '1',
        limit: 10
      });

      expect(result).toEqual([{ id: 1, name: 'entrypoint1' }]);
    });

    it('should paginate', async () => {
      nock('https://example.com')
        .get('/api/v2/projects/1/entry-points?limit=50')
        .reply(200, {
          items: [
            {
              id: 1,
              name: 'entrypoint1',
              createdAt: '2024-08-06T09:40:50.226Z'
            },
            {
              id: 2,
              name: 'entrypoint1',
              createdAt: '2024-08-06T09:40:50.227Z'
            }
          ]
        });

      nock('https://example.com')
        .get(
          '/api/v2/projects/1/entry-points?limit=50&nextId=2&nextCreatedAt=2024-08-06T09:40:50.227Z'
        )
        .reply(200, {
          items: [
            {
              id: 10,
              name: 'entrypoint1',
              createdAt: '2024-08-06T09:40:50.228Z'
            },
            {
              id: 11,
              name: 'entrypoint1',
              createdAt: '2024-08-06T09:40:50.229Z'
            }
          ]
        });

      nock('https://example.com')
        .get(
          '/api/v2/projects/1/entry-points?limit=11&nextId=11&nextCreatedAt=2024-08-06T09:40:50.229Z'
        )
        .reply(200, {
          items: [
            {
              id: 113,
              name: 'entrypoint1',
              createdAt: '2024-08-06T09:40:50.230Z'
            }
          ]
        });

      const result = await restEntryPoints.entrypoints({
        projectId: '1',
        limit: 111
      });

      expect(result).toEqual([
        { id: 1, name: 'entrypoint1', createdAt: '2024-08-06T09:40:50.226Z' },
        { id: 2, name: 'entrypoint1', createdAt: '2024-08-06T09:40:50.227Z' },
        { id: 10, name: 'entrypoint1', createdAt: '2024-08-06T09:40:50.228Z' },
        { id: 11, name: 'entrypoint1', createdAt: '2024-08-06T09:40:50.229Z' },
        { id: 113, name: 'entrypoint1', createdAt: '2024-08-06T09:40:50.230Z' }
      ]);
    });
  });

  describe('changeHost', () => {
    it('should change host for entry points', async () => {
      nock('https://example.com')
        .post('/api/v2/projects/1/entry-points/change_host', {
          entryPointIds: ['1', '2'],
          newHost: 'https://new.example.com',
          oldHost: 'https://old.example.com'
        })
        .reply(200, {});

      await restEntryPoints.changeHost({
        projectId: '1',
        entryPointIds: ['1', '2'],
        newHost: 'https://new.example.com',
        oldHost: 'https://old.example.com'
      });

      expect(nock.isDone()).toBeTruthy();
    });

    it('should change host without oldHost parameter', async () => {
      nock('https://example.com')
        .post('/api/v2/projects/1/entry-points/change_host', {
          entryPointIds: ['1', '2'],
          newHost: 'https://new.example.com'
        })
        .reply(200, {});

      await restEntryPoints.changeHost({
        projectId: '1',
        entryPointIds: ['1', '2'],
        newHost: 'https://new.example.com'
      });

      expect(nock.isDone()).toBeTruthy();
    });

    it('should throw error on API failure', async () => {
      nock('https://example.com')
        .post('/api/v2/projects/1/entry-points/change_host')
        .replyWithError('API Error');

      const result = restEntryPoints.changeHost({
        projectId: '1',
        entryPointIds: ['1'],
        newHost: 'https://new.example.com'
      });
      await expect(result).rejects.toThrow();
    });
  });
});

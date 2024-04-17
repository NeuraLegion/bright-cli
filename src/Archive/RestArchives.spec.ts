import 'reflect-metadata';
import { RestArchives, RestArchivesOptions } from './RestArchives';
import { ProxyFactory } from '../Utils';
import { Spec, SpecType } from './Archives';
import { instance, mock, reset } from 'ts-mockito';
import nock from 'nock';

describe('RestArchives', () => {
  const proxyFactoryMock = mock<ProxyFactory>();

  let restArchives!: RestArchives;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(() => {
    if (!nock.isActive()) {
      nock.activate();
    }

    restArchives = new RestArchives(instance(proxyFactoryMock), {
      baseURL: 'https://example.com/',
      apiKey: 'key'
    } as RestArchivesOptions);
  });

  afterEach(() => {
    reset(proxyFactoryMock);
    nock.cleanAll();
    nock.restore();
  });

  afterAll(() => nock.enableNetConnect());

  describe('upload', () => {
    it('should upload a spec and return the id', async () => {
      // arrange
      const spec: Spec = {
        type: SpecType.OPENAPI,
        filename: 'test.json',
        content: '{}',
        projectId: 'project1'
      };
      const postResponse = { id: 'string' };

      nock('https://example.com/')
        .post('/api/v1/files')
        .reply(200, postResponse, {
          'content-type': 'application/json'
        });

      // act
      const result = await restArchives.upload(spec);

      // assert
      expect(result).toEqual(postResponse.id);
    });

    it('should throw an error if the spec type is not allowed', async () => {
      // arrange
      const spec: Spec = {
        type: 'raml' as SpecType, // not allowed
        filename: 'test.json',
        content: '{}',
        projectId: 'project1'
      };

      // act
      const result = restArchives.upload(spec);

      // assert
      await expect(result).rejects.toThrowError('Invalid specification type');
    });

    it('should send multipart form data correctly', async () => {
      // arrange
      const spec: Spec = {
        type: SpecType.OPENAPI,
        filename: 'test.json',
        content: '{}',
        projectId: 'project1'
      };
      const postResponse = { id: 'string' };

      nock('https://example.com/')
        .post(
          '/api/v1/files',
          (body) =>
            // Check if the body contains the expected multipart form data
            body.includes('Content-Disposition: form-data; name="file"') &&
            body.includes(spec.content) &&
            body.includes('Content-Disposition: form-data; name="projectId"') &&
            body.includes(spec.projectId)
        )
        .reply(200, postResponse, {
          'content-type': 'application/json'
        });

      // act
      const result = await restArchives.upload(spec);

      // assert
      expect(result).toEqual(postResponse.id);
    });

    it('should send query parameters correctly', async () => {
      // arrange
      const spec: Spec = {
        type: SpecType.OPENAPI,
        filename: 'test.json',
        content: '{}',
        projectId: 'project1',
        discard: true
      };
      const postResponse = { id: 'string' };

      nock('https://example.com/')
        .post('/api/v1/files?discard=true')
        .reply(200, postResponse, {
          'content-type': 'application/json'
        });

      // act
      const result = await restArchives.upload(spec);

      // assert
      expect(result).toEqual(postResponse.id);
    });
  });
});

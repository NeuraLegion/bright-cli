import { CliInfo } from '../Config';
import {
  Discovery,
  Module,
  ScanConfig,
  SourceType,
  StorageFile
} from './Scans';
import { RestScans } from './RestScans';
import { ProxyFactory } from '../Utils';
import { instance, mock, reset } from 'ts-mockito';
import nock from 'nock';

describe('RestScans', () => {
  const cliInfoMock = mock<CliInfo>();
  const proxyFactoryMock = mock<ProxyFactory>();

  let restScans!: RestScans;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(() => {
    if (!nock.isActive()) {
      nock.activate();
    }

    restScans = new RestScans(
      instance(cliInfoMock),
      instance(proxyFactoryMock),
      {
        baseURL: 'https://example.com/',
        apiKey: 'key'
      }
    );
  });

  afterEach(() => {
    reset(cliInfoMock);
    nock.cleanAll();
    nock.restore();
  });

  afterAll(() => nock.enableNetConnect());

  describe('create', () => {
    it.each([
      {
        input: SourceType.HAR,
        expected: Discovery.ARCHIVE
      },
      {
        input: SourceType.OPEN_API,
        expected: Discovery.OAS
      },
      {
        input: SourceType.POSTMAN,
        expected: Discovery.OAS
      },
      {
        input: SourceType.RAML,
        expected: Discovery.OAS
      }
    ])(
      'should create a $expected scan if a file is $input spec',
      async ({ input, expected }) => {
        // arrange
        let parsedBody: ScanConfig;
        const postResponse = { id: 'string' };
        const scanConfig: ScanConfig = {
          name: 'scan',
          module: Module.DAST,
          tests: [],
          fileId: 'id'
        };
        const file: StorageFile = { id: scanConfig.fileId, type: input };

        nock('https://example.com/')
          .replyContentLength()
          .get(`/api/v2/files/${scanConfig.fileId}`)
          .reply(200, file, {
            'content-type': 'application/json'
          });

        nock('https://example.com/')
          .replyContentLength()
          .post('/api/v1/scans', (body) => (parsedBody = body))
          .reply(200, postResponse, {
            'content-type': 'application/json'
          });

        // act
        const result = await restScans.create(scanConfig);

        // assert
        expect(result).toEqual(postResponse.id);
        expect(parsedBody).toMatchObject({
          discoveryTypes: expect.arrayContaining<Discovery>([expected])
        });
      }
    );

    it('should throw an error if the file does not exist or the user does not have permissions', async () => {
      // arrange
      const scanConfig: ScanConfig = {
        name: 'scan',
        module: Module.DAST,
        tests: [],
        fileId: 'id'
      };

      // act
      const result = restScans.create(scanConfig);

      // assert
      await expect(result).rejects.toThrowError(
        `Error loading file with id "${scanConfig.fileId}": No such file or you do not have permissions.`
      );
    });
  });

  describe('retest', () => {
    it('should retest a scan and return the id', async () => {
      const res = { id: 'string' };

      nock('https://example.com/')
        .post('/api/v1/scans/scanId/retest')
        .reply(200, res, {
          'content-type': 'application/json'
        });

      const result = await restScans.retest('scanId');

      expect(result).toEqual(res.id);
    });
  });

  describe('status', () => {
    it('should return the status of a scan', async () => {
      const res = { state: 'running' };

      nock('https://example.com/').get('/api/v1/scans/scanId').reply(200, res, {
        'content-type': 'application/json'
      });

      const result = await restScans.status('scanId');

      expect(result).toEqual(res);
    });
  });

  describe('stop', () => {
    it('should stop a scan', async () => {
      nock('https://example.com/').get('/api/v1/scans/scanId/stop').reply(
        200,
        {},
        {
          'content-type': 'application/json'
        }
      );

      await restScans.stop('scanId');

      expect(nock.isDone()).toBeTruthy();
    });
  });

  describe('delete', () => {
    it('should delete a scan', async () => {
      nock('https://example.com/').delete('/api/v1/scans/scanId').reply(
        200,
        {},
        {
          'content-type': 'application/json'
        }
      );

      await restScans.delete('scanId');

      expect(nock.isDone()).toBeTruthy();
    });
  });
});

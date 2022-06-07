import { CliInfo } from '../Config';
import { Module, ScanConfig, SourceType, StorageFile, TestType } from './Scans';
import { RestScans } from './RestScans';
import { instance, mock, reset } from 'ts-mockito';
import { RequestPromiseAPI } from 'request-promise';
import nock from 'nock';

describe('RestScans', () => {
  let restScans!: RestScans;
  const moduleMock = mock<Module>();
  const cliInfoMock = mock<CliInfo>();
  const testTypeMock = mock<TestType>();
  const requestPromiseAPIMock = mock<RequestPromiseAPI>();

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(() => {
    if (!nock.isActive()) {
      nock.activate();
    }

    restScans = new RestScans(instance(cliInfoMock), {
      baseUrl: 'https://development.playground.neuralegion.com',
      apiKey: 'key'
    });
  });

  afterEach(() => {
    reset<CliInfo | TestType | RequestPromiseAPI | Module>(
      cliInfoMock,
      testTypeMock,
      requestPromiseAPIMock,
      moduleMock
    );
    nock.cleanAll();
    nock.restore();
  });

  afterAll(() => nock.enableNetConnect());

  describe('create', () => {
    it('should create a new scan if the HAR file passed by id exists', async () => {
      // arrange
      let parsedBody;
      const postResponse = { id: 'string' };
      const scanConfig: ScanConfig = {
        name: 'scan',
        module: instance(moduleMock),
        tests: [instance(testTypeMock)],
        fileId: 'id'
      };
      const file: StorageFile = { id: scanConfig.fileId, type: SourceType.HAR };

      nock('https://development.playground.neuralegion.com')
        .replyContentLength()
        .get(`/api/v1/files/${scanConfig.fileId}`)
        .reply(200, file, {
          'content-type': 'application/json'
        });

      nock('https://development.playground.neuralegion.com')
        .replyContentLength()
        .post('/api/v1/scans', (body) => {
          parsedBody = body;
          console.log(parsedBody);

          return body;
        })
        .reply(200, postResponse, {
          'content-type': 'application/json'
        });

      // act
      const result = await restScans.create(scanConfig);

      // assert
      expect(result).toEqual(postResponse.id);
      expect(parsedBody).toMatchObject({
        discoveryTypes: expect.arrayContaining<SourceType>([file.type])
      });
    });

    it('should create a new scan if the OAS file passed by id exists', async () => {
      // arrange
      let parsedBody;
      const postResponse = { id: 'string' };
      const scanConfig: ScanConfig = {
        name: 'scan',
        module: instance(moduleMock),
        tests: [instance(testTypeMock)],
        fileId: 'id'
      };
      const file: StorageFile = {
        id: scanConfig.fileId,
        type: SourceType.OPEN_API
      };

      nock('https://development.playground.neuralegion.com')
        .replyContentLength()
        .get(`/api/v1/files/${scanConfig.fileId}`)
        .reply(200, file, {
          'content-type': 'application/json'
        });

      nock('https://development.playground.neuralegion.com')
        .replyContentLength()
        .post('/api/v1/scans', (body) => {
          parsedBody = body;
          console.log(parsedBody);

          return body;
        })
        .reply(200, postResponse, {
          'content-type': 'application/json'
        });

      // act
      const result = await restScans.create(scanConfig);

      // assert
      expect(result).toEqual(postResponse.id);
      expect(parsedBody).toMatchObject({
        discoveryTypes: expect.arrayContaining<SourceType>([file.type])
      });
    });

    it('should throw an error if the file passed by id does not exist or the user does not have permissions', async () => {
      // arrange
      const scanConfig: ScanConfig = {
        name: 'scan',
        module: instance(moduleMock),
        tests: [instance(testTypeMock)],
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
});

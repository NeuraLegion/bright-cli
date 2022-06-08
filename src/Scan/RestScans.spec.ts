import { CliInfo } from '../Config';
import {
  Discovery,
  Module,
  ScanConfig,
  SourceType,
  StorageFile
} from './Scans';
import { RestScans } from './RestScans';
import { instance, mock, reset } from 'ts-mockito';
import nock from 'nock';

interface ResponseBody {
  name: string;
  module: unknown;
  tests: Array<unknown>;
  fileId: string;
  discoveryTypes: Array<Discovery>;
  info: { source: string; client: { name: string } };
}

describe('RestScans', () => {
  let restScans!: RestScans;
  const moduleMock = mock<Module>();
  const cliInfoMock = mock<CliInfo>();

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(() => {
    if (!nock.isActive()) {
      nock.activate();
    }

    restScans = new RestScans(instance(cliInfoMock), {
      baseUrl: 'https://example.com/',
      apiKey: 'key'
    });
  });

  afterEach(() => {
    reset<CliInfo | Module>(cliInfoMock, moduleMock);
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
        let parsedBody: ResponseBody;
        const postResponse = { id: 'string' };
        const scanConfig: ScanConfig = {
          name: 'scan',
          module: instance(moduleMock),
          tests: [],
          fileId: 'id'
        };
        const file: StorageFile = { id: scanConfig.fileId, type: input };

        nock('https://example.com/')
          .replyContentLength()
          .get(`/api/v1/files/${scanConfig.fileId}`)
          .reply(200, file, {
            'content-type': 'application/json'
          });

        nock('https://example.com/')
          .replyContentLength()
          .post('/api/v1/scans', (body) => {
            parsedBody = body;

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
          discoveryTypes: expect.arrayContaining<Discovery>([expected])
        });
      }
    );

    it('should throw an error if the file does not exist or the user does not have permissions', async () => {
      // arrange
      const scanConfig: ScanConfig = {
        name: 'scan',
        module: instance(moduleMock),
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
});

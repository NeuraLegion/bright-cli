import { CliInfo } from '../Config';
import { ScanConfig, StorageFile } from './Scans';
import { RestScans, RestScansOptions } from './RestScans';
import { anything, instance, mock, reset, when } from 'ts-mockito';
import { RequestPromise, RequestPromiseAPI } from 'request-promise';
import { string } from 'yargs';

describe('RestScans', () => {
  let restScans!: RestScans;
  const cliInfoMock = mock<CliInfo>();
  const restScansOptionsMock = mock<RestScansOptions>();
  const scanConfigMock = mock<ScanConfig>();
  const requestPromiseAPIMock = mock<RequestPromiseAPI>();
  const requestPromiseMock = mock<RequestPromise>();
  const storageFileMock = mock<StorageFile>();

  beforeEach(() => {
    restScans = new RestScans(
      instance(cliInfoMock),
      instance(restScansOptionsMock)
    );
  });

  afterEach(() =>
    reset<CliInfo | RestScansOptions | ScanConfig | RequestPromiseAPI>(
      cliInfoMock,
      restScansOptionsMock,
      scanConfigMock,
      requestPromiseAPIMock
    )
  );

  describe('create', () => {
    it('should create a new scan if the file passed by ID exists', async () => {
      // arrange
      const postResponce = { id: string };

      when((requestPromiseMock.body = JSON.stringify(postResponce)));
      when(requestPromiseAPIMock.post(anything())).thenReturn(
        instance(requestPromiseMock)
      );
      when(requestPromiseAPIMock.get(anything())).thenReturn(
        instance(requestPromiseMock)
      );

      // act
      const result = await restScans.create(scanConfigMock);

      // assert
      expect(result).toEqual(postResponce.id);
    });

    it('should return an error if the file passed by ID does not exist or the user does not have permissions', () => {
      undefined;
    });
  });
});

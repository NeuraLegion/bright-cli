import { BaseParser } from './BaseParser';
import { MockRequest } from './NexMock/BaseNexMockConverter';
import { Validator } from '../Validators';
import { HarRecorder } from './NexMock/HarRecorder';
import { NexMockConverter } from './NexMock/NexMockConverter';
import { File } from './Parser';
import { Options } from 'request-promise';

export class NexMockParser extends BaseParser<MockRequest[]> {
  constructor(
    validator: Validator<MockRequest[]>,
    private readonly harRecorder: HarRecorder,
    private readonly converter: NexMockConverter
  ) {
    super(validator);
  }

  public async parse(path: string): Promise<File> {
    const { content, filename } = await super.parse(path);

    const mocks: MockRequest[] = JSON.parse(content);

    const requests: Options[] = await this.converter.convertToRequests(mocks);

    return {
      filename,
      content: await this.harRecorder.record(requests)
    };
  }
}

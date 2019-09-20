import { MockRequest } from '../Parsers/NexMockToRequestsParser';
import { promisify } from 'util';
import { readFile as readFileCb } from 'fs';
import { Parser } from './Parser';
import { Validator } from '../Validators/Validator';

const readFile = promisify(readFileCb);

export class NexMockParser implements Parser<string, MockRequest[]> {
  constructor(
    private readonly validator: Validator<any>,
    private readonly fileValidator: Validator<string>
  ) {}

  public async parse(path: string): Promise<MockRequest[] | never> {
    await this.fileValidator.validate(path);
    const requests: MockRequest[] = await this.readAndDeserialize(path);
    await this.validator.validate(requests);
    return requests;
  }

  private async readAndDeserialize(filePath: string): Promise<MockRequest[]> {
    try {
      const file: string = await readFile(filePath, 'utf8');
      return JSON.parse(file) as MockRequest[];
    } catch (e) {
      throw new Error(
        `NexMock file is invalid. Please specify a different file. ${e.message}`
      );
    }
  }
}

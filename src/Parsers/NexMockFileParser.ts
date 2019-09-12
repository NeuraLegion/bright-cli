import { MockRequest } from './NexMockToRequestsParser';
import { readFile as readFileCb } from 'fs';
import { FileExistingValidator } from '../Validators/FileExistingValidator';
import { NexMockValidator } from '../Validators/NexMockValidator';
import { promisify } from 'util';

const readFile = promisify(readFileCb);

export class NexMockFileParser {
  private readonly fileExistingValidator: FileExistingValidator;
  private readonly mockRequestsValidator: NexMockValidator;

  constructor() {
    this.fileExistingValidator = new FileExistingValidator();
    this.mockRequestsValidator = new NexMockValidator();
  }

  public async parse(path: string): Promise<MockRequest[] | never> {
    if (!path) {
      throw new Error('The path is invalid.');
    }
    await this.fileExistingValidator.validate(path);
    const requests: MockRequest[] = await this.readAndDeserialize(path);
    await this.mockRequestsValidator.validate(requests);
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

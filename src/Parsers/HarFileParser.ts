import { Har } from 'har-format';
import { readFile as readFileCb } from 'fs';
import { promisify } from 'util';
import { HarValidator } from '../Validators/HarValidator';
import { FileExistingValidator } from '../Validators/FileExistingValidator';

const readFile = promisify(readFileCb);

export class HarFileParser {
  private readonly fileExistingValidator: FileExistingValidator;
  private readonly harValidator: HarValidator;

  constructor() {
    this.fileExistingValidator = new FileExistingValidator();
    this.harValidator = new HarValidator();
  }

  public async parse(path: string): Promise<Har | never> {
    if (!path) {
      throw new Error('The path is invalid.');
    }
    await this.fileExistingValidator.validate(path);
    const har: Har = await this.readAndDeserialize(path);
    await this.harValidator.validate(har);
    return har;
  }

  private async readAndDeserialize(filePath: string): Promise<Har> {
    try {
      const file: string = await readFile(filePath, 'utf8');
      return JSON.parse(file) as Har;
    } catch (e) {
      throw new Error(
        `HAR file is invalid. Please specify a different file. ${e.message}`
      );
    }
  }
}

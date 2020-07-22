import { Parser } from './Parser';
import { Validator } from '../Validators';
import { Har } from 'har-format';
import { readFile as readFileCb } from 'fs';
import { promisify } from 'util';

const readFile = promisify(readFileCb);

export class HarFileParser implements Parser<string, Har> {
  constructor(
    private readonly validator: Validator<any>,
    private readonly fileValidator: Validator<string>
  ) {}

  public async parse(path: string): Promise<Har | null> {
    await this.fileValidator.validate(path);
    const har: Har = await this.readAndDeserialize(path);
    await this.validator.validate(har);

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

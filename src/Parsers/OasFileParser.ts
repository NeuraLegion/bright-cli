import { Har } from 'har-format';
import { readFile as readFileCb } from 'fs';
import { promisify } from 'util';
import { FileExistingValidator } from '../Validators/FileExistingValidator';
import { extname } from 'path';
import { OasValidator } from '../Validators/OasValidator';

const readFile = promisify(readFileCb);

export class OasFileParser {
  private readonly fileExistingValidator: FileExistingValidator;
  private readonly validator: OasValidator;

  constructor() {
    this.fileExistingValidator = new FileExistingValidator();
    this.validator = new OasValidator();
  }

  public async parse(path: string): Promise<Har | never> {
    if (!path) {
      throw new Error('The path is invalid.');
    }
    await this.fileExistingValidator.validate(path);
    const har: Har = await this.readAndDeserialize(path);
    await this.validator.validate(har);
    return har;
  }

  private async readAndDeserialize(filePath: string): Promise<Har> {
    try {
      const file: string = await readFile(filePath, 'utf8');
      const ext: string = extname(filePath.toLowerCase());

      if (ext === '.yml' || ext === '.yaml') {
        return (await import('js-yaml')).safeLoad(file);
      } else {
        return JSON.parse(file);
      }
    } catch (e) {
      throw new Error(
        `OAS file is invalid. Please specify a different file. ${e.message}`
      );
    }
  }
}

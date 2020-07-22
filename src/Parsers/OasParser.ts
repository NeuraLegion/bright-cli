import { Parser } from './Parser';
import { Validator } from '../Validators';
import { extname } from 'path';
import { promisify } from 'util';
import { readFile as readFileCb } from 'fs';

const readFile = promisify(readFileCb);

export class OasParser implements Parser<string> {
  constructor(
    private readonly validator: Validator<any>,
    private readonly fileValidator: Validator<string>
  ) {}

  public async parse(data: string): Promise<any | null> {
    await this.fileValidator.validate(data);
    const oas: any = await this.readAndDeserialize(data);
    await this.validator.validate(oas);

    return oas;
  }

  private async readAndDeserialize(filePath: string): Promise<any> {
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

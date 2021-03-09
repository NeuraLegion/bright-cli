import { Validator } from '../Validators';
import { File, Parser } from './Parser';
import { promisify } from 'util';
import { access as exists, constants, readFile as read } from 'fs';
import { ok } from 'assert';
import { basename, extname } from 'path';

const readFile = promisify(read);
const access = promisify(exists);

export class BaseParser<T> implements Parser {
  constructor(protected readonly validator: Validator<T>) {}

  public async parse(path: string): Promise<File> {
    await this.access(path);

    const content: string = await readFile(path, 'utf8');
    const ext: string = extname(path);

    let data: T | undefined;

    try {
      data = await this.deserialize(content, {
        ext
      });
    } catch (e) {
      throw new Error(`File is invalid. ${e.message}`);
    }

    await this.validator.validate(data);

    return {
      content,
      filename: basename(path),
      contentType: this.contentType(ext)
    };
  }

  protected deserialize(file: string, _meta?: { ext: string }): Promise<T> | T {
    return JSON.parse(file) as T;
  }

  private contentType(ext: string): string {
    switch (ext) {
      case '.yml':
      case '.yaml':
        return 'application/yaml';
      case '.json':
      default:
        return 'application/json';
    }
  }

  private async access(path: string): Promise<never | void> {
    ok(path, `The path is invalid.`);

    try {
      await access(path, constants.F_OK);
    } catch (e) {
      throw new Error(`${basename(path)} file doesn't found.`);
    }
  }
}

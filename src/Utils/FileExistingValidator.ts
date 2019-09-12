import { access, constants } from 'fs';
import { promisify } from 'util';
import { basename } from 'path';

const accessPromisified = promisify(access);

export class FileExistingValidator {
  public async validate(path: string): Promise<void | never> {
    try {
      await accessPromisified(path, constants.F_OK);
    } catch (e) {
      throw new Error(`${basename(path)} file doesn't found.`);
    }
  }
}

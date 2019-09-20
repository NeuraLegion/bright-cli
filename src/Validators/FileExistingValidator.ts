import { access as accessCb, constants } from 'fs';
import { basename } from 'path';
import { promisify } from 'util';
import { Validator } from './Validator';

const access = promisify(accessCb);

export class FileExistingValidator implements Validator<string> {
  public async validate(path: string): Promise<void | never> {
    if (!path) {
      throw new Error('The path is invalid.');
    }

    try {
      await access(path, constants.F_OK);
    } catch (e) {
      throw new Error(`${basename(path)} file doesn't found.`);
    }
  }
}

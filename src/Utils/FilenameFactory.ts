import { injectable } from 'tsyringe';
import { basename, extname, resolve } from 'node:path';

@injectable()
export class FilenameFactory {
  private counter: number = 1;

  public generatorFilename(filePath: string): string {
    const ext: string = extname(filePath);
    const name: string = basename(filePath, ext);
    if (this.counter === 1) {
      this.counter++;

      return filePath;
    }

    return resolve(filePath, '..', `${name}_${this.counter++}${ext}`);
  }
}

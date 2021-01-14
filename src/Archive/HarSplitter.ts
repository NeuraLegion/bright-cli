import { FilenameFactory, Helpers, logger } from '../Utils';
import { Entry, Har } from 'har-format';
import { injectable } from 'tsyringe';
import { promisify } from 'util';
import { writeFile as write } from 'fs';

const writeFile = promisify(write);

@injectable()
export class HarSplitter {
  constructor(private readonly fileNameFactory: FilenameFactory) {}

  public async split(
    har: Har,
    { baseName, count = 1 }: { count?: number; baseName: string }
  ): Promise<string[]> {
    const { log } = har;

    if (log.entries.length > 1000 && count === 1) {
      logger.warn(`Warning: The HAR contains too many entries.`);
      logger.warn(
        'Recommend to use "split" option to split it to multiple HAR files.'
      );
    }

    const countInChunk = log.entries.length / count;

    const chunks: Entry[][] =
      count > 0 ? Helpers.split(log.entries, countInChunk) : [log.entries];

    return Promise.all(
      chunks.map((items: Entry[]) =>
        this.saveChunk(baseName, { log: { ...log, entries: items } })
      )
    );
  }

  private async saveChunk(baseName: string, har: Har): Promise<string> {
    const fileName: string = this.fileNameFactory.generatorFilename(baseName);

    await writeFile(fileName, JSON.stringify(har), {
      encoding: 'utf8'
    });

    return fileName;
  }
}

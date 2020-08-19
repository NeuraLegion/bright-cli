import { Helpers } from '../Utils/Helpers';
import { FilenameFactory } from '../Utils/FilenameFactory';
import logger from '../Utils/Logger';
import { Entry, Har } from 'har-format';
import { promisify } from 'util';
import { writeFile as write } from 'fs';

const writeFile = promisify(write);

export class HarSplitter {
  constructor(
    private readonly baseName: string,
    private readonly fileNameFactory: FilenameFactory = new FilenameFactory()
  ) {}

  public async split(count: number = 1, har: Har): Promise<string[]> {
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
        this.saveChunk({ log: { ...log, entries: items } })
      )
    );
  }

  private async saveChunk(har: Har): Promise<string> {
    const fileName: string = this.fileNameFactory.generatorFilename(
      this.baseName
    );

    await writeFile(fileName, JSON.stringify(har), {
      encoding: 'utf8'
    });

    return fileName;
  }
}

import { split } from '../Utils/split';
import { generatorFileNameFactory } from '../Utils/generateFileName';
import { DefaultParserFactory, Parser } from '../Archive';
import { parseHeaders } from '../Utils/parserHeaders';
import { SpecType } from '../Archive/Archives';
import { Arguments, Argv, CommandModule } from 'yargs';
import { Entry, Har } from 'har-format';
import { promisify } from 'util';
import { basename } from 'path';
import { writeFile as write } from 'fs';

const writeFile = promisify(write);

export class GenerateArchive implements CommandModule {
  public readonly command = 'archive:generate';
  public readonly describe = 'Generates a new archive on base unit-tests.';

  public builder(args: Argv): Argv {
    return args
      .option('mockfile', {
        alias: 'm',
        normalize: true,
        describe: 'Mock file.',
        demandOption: true
      })
      .option('pool', {
        alias: 'p',
        number: true,
        default: 250,
        describe: 'Size of the worker pool.'
      })
      .option('timeout', {
        number: true,
        default: 5000,
        describe:
          'Time to wait for a server to send response headers (and start the response body) before aborting the request.'
      })
      .option('split', {
        alias: 's',
        number: true,
        default: 1,
        describe:
          'Number of the HAR chunks. Allows to split a mock file to into multiple HAR files.'
      })
      .option('archive', {
        alias: 'f',
        normalize: true,
        describe: 'Name of the archive.',
        demandOption: true
      })
      .option('target', {
        alias: 't',
        describe: 'Target hostname or IP address.',
        demandOption: true
      })
      .option('header', {
        alias: 'H',
        default: [],
        array: true,
        describe:
          'A list of specific headers that should be included into request.'
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const parserFactory = new DefaultParserFactory({
        timeout: args.timeout as number,
        pool: args.pool as number,
        proxyUrl: args.proxy as string,
        baseUrl: args.target as string,
        headers: parseHeaders(args.header as string[])
      });

      const parser: Parser = parserFactory.create(SpecType.NEXMOCK);
      const { content } = await parser.parse(args.mockfile as string);

      const { log } = JSON.parse(content) as Har;

      console.log(`${log.entries?.length} requests were prepared.`);

      const chunks: Entry[][] =
        (args.split as number) > 0
          ? split(log.entries, log.entries.length / (args.split as number))
          : [log.entries];

      const generateFileName: (
        filePath: string
      ) => string = generatorFileNameFactory();

      const fileNames: string[] = await Promise.all(
        chunks.map(async (items: Entry[]) => {
          const fileName: string = generateFileName(args.archive as string);
          await writeFile(
            fileName,
            JSON.stringify({ log: { ...log, entries: items } }),
            {
              encoding: 'utf8'
            }
          );

          return fileName;
        })
      );

      const plural: boolean = fileNames.length > 1;

      console.log(
        `${fileNames.map((name: string) => basename(name))} ${
          plural ? 'archives' : 'archive'
        } ${plural ? 'were' : 'was'} created on base ${basename(
          args.mockfile as string
        )} mockfile.`
      );
      process.exit(0);
    } catch (e) {
      console.error(`Error during "archive:generate" run: ${e.message}`);
      process.exit(1);
    }
  }
}

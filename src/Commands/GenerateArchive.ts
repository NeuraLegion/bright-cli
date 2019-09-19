import { writeFile as writeFileCb } from 'fs';
import {
  MockRequest,
  NexMockToRequestsParser
} from '../Parsers/NexMockToRequestsParser';
import { RequestCrawler } from '../Parsers/RequestCrawler';
import * as yargs from 'yargs';
import { InlineHeaders } from '../Parsers/InlineHeaders';
import { basename } from 'path';
import { NexMockFileParser } from '../Parsers/NexMockFileParser';
import { Options } from 'request';
import { promisify } from 'util';
import { split } from '../Utils/split';
import { generatorFileNameFactory } from '../Utils/generateFileName';

const writeFile = promisify(writeFileCb);

export class GenerateArchive implements yargs.CommandModule {
  public readonly command = 'archive:generate';
  public readonly describe = 'Generates a new archive on base unit-tests.';

  public builder(args: yargs.Argv): yargs.Argv {
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

  public async handler(args: yargs.Arguments): Promise<void> {
    try {
      const nexMockFileParser: NexMockFileParser = new NexMockFileParser();

      const nexMocks: MockRequest[] = await nexMockFileParser.parse(
        args.mockfile as string
      );
      console.log(
        `${basename(args.mockfile as string)} was verified and parsed.`
      );
      const nexMockRequestsParser: NexMockToRequestsParser = new NexMockToRequestsParser(
        {
          url: args.target as string,
          headers: new InlineHeaders(args.header as string[]).get()
        }
      );
      const requestOptions: Options[] = await nexMockRequestsParser.parse(
        nexMocks
      );
      console.log(`${requestOptions.length} requests were prepared.`);

      const chunks: Options[][] =
        (args.split as number) > 0
          ? split(
              requestOptions,
              requestOptions.length / (args.split as number)
            )
          : [requestOptions];

      const generateFileName: (
        filePath: string
      ) => string = generatorFileNameFactory();

      const fileNames: string[] = await Promise.all(
        chunks.map(async (items: Options[]) => {
          const crawler: RequestCrawler = new RequestCrawler({
            timeout: args.timeout as number,
            pool: args.pool as number
          });
          const harFile: string = await crawler.parse(items);
          const fileName: string = generateFileName(args.archive as string);
          await writeFile(fileName, harFile, {
            encoding: 'utf8'
          });
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

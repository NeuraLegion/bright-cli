import { writeFile as writeFileCb } from 'fs';
import { MockRequest, NexMockToRequestsParser } from '../Parsers/NexMockToRequestsParser';
import { RequestCrawler } from '../Parsers/RequestCrawler';
import * as yargs from 'yargs';
import { InlineHeaders } from '../Parsers/InlineHeaders';
import { basename } from 'path';
import { NexMockFileParser } from '../Parsers/NexMockFileParser';
import { Options } from 'request';
import { promisify } from 'util';

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
      const nexMockRequestsParser: NexMockToRequestsParser = new NexMockToRequestsParser(
        {
          url: args.target as string,
          headers: new InlineHeaders(args.header as string[]).get()
        }
      );
      const crawler: RequestCrawler = new RequestCrawler({
        timeout: args.timeout as number,
        pool: args.pool as number
      });
      const nexMocks: MockRequest[] = await nexMockFileParser.parse(
        args.mockfile as string
      );
      console.log(`${basename(args.mockfile as string)} was verified and parsed.`);
      const requestOptions: Options[] = await nexMockRequestsParser.parse(
        nexMocks
      );
      console.log(`${requestOptions.length} requests were prepared.`);
      const harFile: string = await crawler.parse(requestOptions);

      await writeFile(args.archive as string, harFile, { encoding: 'utf8' });

      console.log(
        `${basename(
          args.archive as string
        )} archive was created on base ${basename(
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

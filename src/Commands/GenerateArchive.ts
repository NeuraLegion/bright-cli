import {createReadStream, createWriteStream} from 'fs';
import {MockRequestsParser} from '../Parsers/MockRequestsParser';
import {RequestCrawler} from '../Parsers/RequestCrawler';
import * as yargs from 'yargs';
import {InlineHeaders} from '../Parsers/InlineHeaders';
import {basename} from 'path';
import {pipeline} from 'stream';
import {FileExistingValidator} from '../Utils/FileExistingValidator';

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
        describe: 'Time to wait for a server to send response headers (and start the response body) before aborting the request.'
      })
      .option('archive', {
        alias: 'f',
        normalize: true,
        describe: 'Name of the archive.',
        demandOption: true
      })
      .option('target', {
        alias: 't',
        describe: 'Target hostname or IP address.'
      })
      .option('header', {
        alias: 'H',
        default: [],
        array: true,
        describe: 'A list of specific headers that should be included into request.'
      });
  }

  public async handler(args: yargs.Arguments): Promise<void> {
    try {
      await new FileExistingValidator()
        .validate(args.mockfile as string);

      pipeline(
        createReadStream(args.mockfile as string, {encoding: 'utf8'}),
        new MockRequestsParser({
          url: args.target as string,
          headers: new InlineHeaders(args.header as string[]).get()
        }),
        new RequestCrawler({
          timeout: args.timeout as number,
          pool: args.pool as number
        }),
        createWriteStream(args.archive as string),
        (err) => {
          if (err) {
            console.error(`Error during "archive:generate" run: ${err.message}`);
            process.exit(1);
          } else {
            console.log(`${basename(args.archive as string)} archive was created on base ${basename(args.mockfile as string)} mockfile.`);
            process.exit(0);
          }
        }
      );
    } catch (e) {
      console.error(`Error during "archive:generate" run: ${e.message}`);
      process.exit(1);
    }
  }
}

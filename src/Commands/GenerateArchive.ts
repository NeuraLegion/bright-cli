import {
  HarRecorderOptions,
  HarSplitter,
  NexMockConverterOptions,
  Parser,
  ParserFactory,
  RestArchivesOptions,
  SpecType
} from '../Archive';
import { Helpers, logger } from '../Utils';
import { container } from '../Config';
import { Arguments, Argv, CommandModule } from 'yargs';
import { Har } from 'har-format';
import { basename } from 'path';

export class GenerateArchive implements CommandModule {
  public readonly command = 'archive:generate [options] <mockfile>';
  public readonly describe = 'Generates a new archive on base unit-tests.';

  public builder(argv: Argv): Argv {
    return argv
      .option('pool', {
        alias: 'p',
        number: true,
        requiresArg: true,
        default: 250,
        describe: 'Size of the worker pool.'
      })
      .option('timeout', {
        number: true,
        requiresArg: true,
        default: 5000,
        describe:
          'Time to wait for a server to send response headers (and start the response body) before aborting the request.'
      })
      .option('split', {
        alias: 's',
        number: true,
        requiresArg: true,
        default: 1,
        describe:
          'Number of the HAR chunks. Allows to split a mock file to into multiple HAR files.'
      })
      .option('output', {
        alias: 'o',
        normalize: true,
        requiresArg: true,
        describe: 'Name of the archive.',
        demandOption: true
      })
      .option('target', {
        alias: 'T',
        requiresArg: true,
        describe: 'Target hostname or IP address.',
        demandOption: true
      })
      .option('header', {
        alias: 'H',
        requiresArg: true,
        default: [],
        array: true,
        describe:
          'A list of specific headers that should be included into request.'
      })
      .positional('mockfile', {
        normalize: true,
        describe: 'Mock file.',
        demandOption: true
      })
      .middleware((args: Arguments) => {
        container
          .register(HarRecorderOptions, {
            useValue: {
              timeout: args.timeout as number,
              maxRedirects: 20,
              pool: args.pool as number,
              proxyUrl: args.proxy as string
            } as HarRecorderOptions
          })
          .register(NexMockConverterOptions, {
            useValue: {
              headers: Helpers.parseHeaders(args.header as string[]),
              url: args.target as string
            } as NexMockConverterOptions
          })
          .register(RestArchivesOptions, {
            useValue: {
              baseUrl: args.api as string,
              apiKey: args.token as string,
              proxyUrl: args.proxy as string
            }
          });
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const parserFactory: ParserFactory = container.resolve(ParserFactory);

      const parser: Parser = parserFactory.create(SpecType.NEXMOCK);
      const { content } = await parser.parse(args.mockfile as string);

      const { log } = JSON.parse(content) as Har;

      logger.log(`${log.entries.length ?? 0} requests were prepared.`);

      const harSplitter = container.resolve(HarSplitter);

      const fileNames: string[] = await harSplitter.split(
        { log },
        {
          count: args.split as number,
          baseName: args.output as string
        }
      );

      const plural: boolean = fileNames.length > 1;

      logger.log(
        `${fileNames.map((name: string) => basename(name))} ${
          plural ? 'archives' : 'archive'
        } ${plural ? 'were' : 'was'} created on base ${basename(
          args.mockfile as string
        )} mockfile.`
      );
      process.exit(0);
    } catch (e) {
      logger.error(`Error during "archive:generate": ${e.message}`);
      process.exit(1);
    }
  }
}

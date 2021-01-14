import {
  DefaultParserFactory,
  HarSplitter,
  Parser,
  SpecType
} from '../Archive';
import { Helpers, logger } from '../Utils';
import { Arguments, Argv, CommandModule } from 'yargs';
import { Har } from 'har-format';
import { basename } from 'path';

export class GenerateArchive implements CommandModule {
  public readonly command = 'archive:generate [options] <mockfile>';
  public readonly describe = 'Generates a new archive on base unit-tests.';

  public builder(args: Argv): Argv {
    return args
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
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const parserFactory = new DefaultParserFactory({
        timeout: args.timeout as number,
        pool: args.pool as number,
        proxyUrl: args.proxy as string,
        baseUrl: args.target as string,
        headers: Helpers.parseHeaders(args.header as string[])
      });

      const parser: Parser = parserFactory.create(SpecType.NEXMOCK);
      const { content } = await parser.parse(args.mockfile as string);

      const { log } = JSON.parse(content) as Har;

      logger.log(`${log.entries.length ?? 0} requests were prepared.`);

      const harSplitter = new HarSplitter(args.output as string);

      const fileNames: string[] = await harSplitter.split(
        args.split as number,
        { log }
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

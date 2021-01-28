import {
  Archives,
  HarRecorderOptions,
  NexMockConverterOptions,
  Parser,
  ParserFactory,
  RestArchivesOptions,
  Spec,
  SpecType
} from '../Archive';
import { Helpers, logger } from '../Utils';
import { container } from '../Config';
import { Arguments, Argv, CommandModule } from 'yargs';

export class UploadArchive implements CommandModule {
  public readonly command = 'archive:upload [options] <file>';
  public readonly describe = 'Uploads a archive to nexploit.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'NexPloit API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('type', {
        alias: 'T',
        requiresArg: true,
        describe: 'The specification type',
        choices: [
          SpecType.OPENAPI,
          SpecType.HAR,
          SpecType.POSTMAN
        ].map((x: string) => x.toLowerCase()),
        default: SpecType.HAR.toLowerCase(),
        demandOption: true
      })
      .option('discard', {
        alias: 'd',
        default: true,
        boolean: true,
        describe:
          'Indicates if archive should be remove or not after scan running. Enabled by default.'
      })
      .option('header', {
        alias: 'H',
        default: [],
        requiresArg: true,
        array: true,
        describe:
          'A list of specific headers that should be included into request.'
      })
      .option('variable', {
        alias: 'V',
        default: [],
        requiresArg: true,
        array: true,
        describe:
          'A list of specific variables that should be included into request. Only for Postman'
      })
      .positional('file', {
        describe:
          "A collection your app's http/websockets logs into HAR file. " +
          'Usually you can use browser dev tools or our browser web extension',
        type: 'string',
        demandOption: true,
        normalize: true
      })
      .group(['header'], 'OAS Options')
      .group(['header', 'variable'], 'Postman Options')
      .middleware((args: Arguments) => {
        container
          .register(HarRecorderOptions, {
            useValue: {
              timeout: 10000,
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

      const type = Helpers.selectEnumValue(
        SpecType,
        args.type as string
      ) as SpecType;
      const parser: Parser = parserFactory.create(type);

      const { content, filename } = await parser.parse(args.file as string);

      const archives: Archives = container.resolve(Archives);

      const spec: Spec = {
        type,
        content,
        filename,
        discard: args.discard as boolean,
        headers: Helpers.parseHeaders(args.header as string[]),
        variables: Helpers.parseHeaders(args.variable as string[])
      };

      const archiveId: string | undefined =
        type === SpecType.HAR
          ? await archives.upload(spec)
          : await archives.convertAndUpload(spec);

      logger.log(archiveId);
      process.exit(0);
    } catch (e) {
      logger.error(`Error during "archive:generate": ${e.message}`);
      process.exit(1);
    }
  }
}

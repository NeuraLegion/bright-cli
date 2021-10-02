import {
  Archives,
  HarRecorderOptions,
  NexMockConverterOptions,
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
  public readonly describe = 'Uploads a archive to NexPloit.';

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
        choices: [SpecType.OPENAPI, SpecType.HAR, SpecType.POSTMAN].map(
          (x: string) => x.toLowerCase()
        ),
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
          'A list of specific headers that should be included into request.',
        coerce(arg: string[]): Record<string, string> {
          return Array.isArray(arg) ? Helpers.parseHeaders(arg) : {};
        }
      })
      .option('variable', {
        alias: 'V',
        default: [],
        requiresArg: true,
        array: true,
        describe:
          'A list of specific variables that should be included into request. Only for Postman',
        coerce(arg: string[]): Record<string, string> {
          return Array.isArray(arg) ? Helpers.parseHeaders(arg) : {};
        }
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
          .register<HarRecorderOptions>(HarRecorderOptions, {
            useValue: {
              timeout: 10000,
              maxRedirects: 20,
              pool: args.pool as number,
              proxyUrl: (args.proxyInternal ?? args.proxy) as string
            } as HarRecorderOptions
          })
          .register<NexMockConverterOptions>(NexMockConverterOptions, {
            useValue: {
              headers: args.header as Record<string, string>,
              url: args.target as string
            } as NexMockConverterOptions
          })
          .register<RestArchivesOptions>(RestArchivesOptions, {
            useValue: {
              insecure: args.insecure as boolean,
              baseUrl: args.api as string,
              apiKey: args.token as string,
              proxyUrl: (args.proxyExternal ?? args.proxy) as string
            }
          });
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const parserFactory: ParserFactory = container.resolve(ParserFactory);
      const archives: Archives = container.resolve(Archives);

      const parser = parserFactory.create(
        Helpers.selectEnumValue(SpecType, args.type as string) as SpecType
      );

      const file = await parser.parse(args.file as string);

      const spec: Spec = {
        ...file,
        type: args.type as SpecType,
        discard: args.discard as boolean,
        headers: args.header as Record<string, string>,
        variables: args.variable as Record<string, string>
      };

      console.log(await archives.upload(spec));
      process.exit(0);
    } catch (e) {
      logger.error(`Error during "archive:generate": ${e.message}`);
      process.exit(1);
    }
  }
}

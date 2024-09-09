import {
  Archives,
  ParserFactory,
  RestArchivesOptions,
  Spec,
  SpecType
} from '../Archive';
import { Helpers, logger } from '../Utils';
import container from '../container';
import { Arguments, Argv, CommandModule } from 'yargs';

export class UploadArchive implements CommandModule {
  public readonly command = 'archive:upload [options] <file>';
  public readonly describe = 'Uploads a archive to Bright.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
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
      .option('projectId', {
        alias: 'p',
        describe:
          'ID of the project for uploading file (Optional for transition period, will be mandatory in future)' +
          'In case project-level API key project ID determined from that API key'
      })
      .option('header', {
        alias: 'H',
        default: [],
        deprecated:
          'Use --header when running a scan using the scan:run command.',
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
        deprecated:
          'Directly integrate variables into the file. For updated guidelines on managing variables effectively, refer to https://learning.postman.com/docs/sending-requests/variables/variables/#variable-scopes',
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
        container.register<RestArchivesOptions>(RestArchivesOptions, {
          useValue: {
            insecure: args.insecure as boolean,
            baseURL: args.api as string,
            apiKey: args.token as string,
            proxyURL: (args.proxyBright ?? args.proxy) as string,
            timeout: (args.timeout as number) * 1000
          }
        });
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const parserFactory: ParserFactory = container.resolve(ParserFactory);
      const archives: Archives = container.resolve(Archives);

      const type = Helpers.selectEnumValue(
        SpecType,
        args.type as string
      ) as SpecType;

      const parser = parserFactory.create(type);

      const file = await parser.parse(args.file as string);

      const spec: Spec = {
        ...file,
        type,
        discard: args.discard as boolean,
        projectId: args.projectId as string,
        headers: args.header as Record<string, string>,
        variables: args.variable as Record<string, string>
      };

      // eslint-disable-next-line no-console
      console.log(await archives.upload(spec));
      process.exit(0);
    } catch (e) {
      logger.error(`Error during "archive:upload": ${e.message}`);
      process.exit(1);
    }
  }
}

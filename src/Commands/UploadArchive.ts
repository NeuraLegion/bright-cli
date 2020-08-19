import {
  DefaultParserFactory,
  Parser,
  RestArchives,
  Spec,
  SpecType
} from '../Archive';
import { Helpers } from '../Utils/Helpers';
import logger from '../Utils/Logger';
import { Arguments, Argv, CommandModule } from 'yargs';

export class UploadArchive implements CommandModule {
  public readonly command = 'archive:upload [options] <file>';
  public readonly describe = 'Uploads a archive to nexploit.';

  public builder(args: Argv): Argv {
    return args
      .option('api', {
        default: 'https://nexploit.app/',
        hidden: true,
        global: true,
        describe: 'NexPloit base url'
      })
      .option('api-key', {
        alias: 'K',
        describe: 'NexPloit API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('proxy', {
        describe: 'SOCKS4 or SOCKS5 url to proxy all traffic'
      })
      .option('type', {
        alias: 't',
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
        array: true,
        describe:
          'A list of specific headers that should be included into request.'
      })
      .option('variable', {
        alias: 'V',
        default: [],
        array: true,
        describe:
          'A list of specific variables that should be included into request. Only for Postman'
      })
      .positional('file', {
        describe:
          "A collection your app's http/websockets logs into HAR file. " +
          'Usually you can use browser dev tools or our browser web extension',
        type: 'string',
        normalize: true
      })
      .group(['header'], 'OAS Options');
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

      const parser: Parser = parserFactory.create(args.type as SpecType);

      const { content, filename } = await parser.parse(args.file as string);

      const archives = new RestArchives({
        baseUrl: args.api as string,
        apiKey: args.apiKey as string,
        proxyUrl: args.proxy as string
      });

      const spec: Spec = {
        filename,
        content,
        discard: args.discard as boolean,
        headers: Helpers.parseHeaders(args.header as string[]),
        variables: Helpers.parseHeaders(args.variable as string[]),
        type: Helpers.selectEnumValue(SpecType, args.type as string) as SpecType
      };

      let archiveId: string | undefined;

      if (args.type === SpecType.HAR) {
        archiveId = await archives.upload(spec);
      } else {
        archiveId = await archives.convertAndUpload(spec);
      }

      logger.log(archiveId);
      process.exit(0);
    } catch (e) {
      logger.error(`Error during "archive:generate": ${e.message}`);
      process.exit(1);
    }
  }
}

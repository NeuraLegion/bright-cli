import { InlineHeaders } from '../Parsers';
import { Discovery, ServicesApiFactory } from '../Strategy';
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
      .option('discovery', {
        alias: 't',
        requiresArg: true,
        describe: 'Archive-type scan or OAS-type scan.',
        choices: ['archive', 'oas'],
        default: 'archive',
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
      const archiveId: string = await new ServicesApiFactory(
        args.api as string,
        args.apiKey as string,
        args.proxy as string
      )
        .createUploadStrategyFactory()
        .create(args.discovery as Discovery)
        .upload({
          path: args.file as string,
          discard: args.discard as boolean,
          headers: new InlineHeaders().parse(args.header as string[])
        });
      console.log(archiveId);
      process.exit(0);
    } catch (e) {
      console.error(`Error during "archive:generate" run: ${e.message}`);
      process.exit(1);
    }
  }
}

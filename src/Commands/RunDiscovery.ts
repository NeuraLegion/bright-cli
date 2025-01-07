import { Discoveries, DiscoveryConfig } from '../Discovery';
import { ErrorMessageFactory, logger } from '../Utils';
import { RestDiscoveryOptions } from 'src/Discovery/RestDiscoveries';
import { container } from 'tsyringe';
import { Arguments, Argv, CommandModule } from 'yargs';

export class RunDiscovery implements CommandModule {
  public readonly command = 'discovery:run [options]';
  public readonly describe =
    'Start a new discovery for the received configuration.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
        string: true,
        requiresArg: true,
        demandOption: true
      })
      .option('project', {
        alias: 'p',
        describe: 'ID of the project',
        string: true,
        requiresArg: true,
        demandOption: true
      })
      .option('name', {
        alias: 'n',
        describe: 'Name of the discovery.',
        string: true,
        requiresArg: true,
        demandOption: true
      })
      .option('auth', {
        alias: 'o',
        describe: 'Auth object ID.',
        string: true,
        requiresArg: true
      })
      .option('repeater', {
        alias: 'agent',
        requiresArg: true,
        array: true,
        describe: 'ID of any repeaters connected with the discovery.'
      })
      .option('archive', {
        alias: 'a',
        normalize: true,
        requiresArg: true,
        describe:
          "A collection of your app's http/websockets logs into HAR file. " +
          'Usually you can use browser dev tools or our browser web extension'
      })
      .option('crawler', {
        alias: 'c',
        requiresArg: true,
        array: true,
        describe:
          'A list of specific urls that should be included into crawler.'
      })
      .option('host-filter', {
        alias: 'F',
        requiresArg: true,
        array: true,
        describe: 'A list of specific hosts that should be included into scan.'
      })
      .option('header', {
        alias: 'H',
        requiresArg: true,
        array: true,
        describe:
          'A list of specific headers that should be included into request.'
      })
      .option('smart', {
        boolean: true,
        describe:
          'Use automatic smart decisions such as: parameter skipping, detection phases, etc. to minimize scan time.'
      })
      .option('crawl-parent-subdomains', {
        boolean: true,
        describe: 'Crawl parent path folders and subdomains',
        default: false
      })
      .option('concurrency', {
        number: true,
        default: 10,
        describe:
          'Number of maximum concurrent requests allowed to be sent to the target, can range between 1 to 50 (default: 10).',
        requiresArg: true
      })
      .option('interactions-depth', {
        number: true,
        default: 3,
        describe:
          'Number of maximum interactions with nested objects, can range between 1 to 5 (default: 3).',
        requiresArg: true
      })
      .middleware((args: Arguments) =>
        container.register<RestDiscoveryOptions>(RestDiscoveryOptions, {
          useValue: {
            insecure: args.insecure as boolean,
            baseURL: args.api as string,
            apiKey: args.token as string,
            proxyURL: (args.proxyBright ?? args.proxy) as string,
            timeout: args.timeout as number
          }
        })
      );
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const discoveryManager: Discoveries = container.resolve(Discoveries);

      const projectId = args.project as string;

      const { id: discoveryId, warnings } = await discoveryManager.create(
        projectId,
        {
          name: args.name,
          authObjectId: args.auth,
          hostsFilter: args.hostFilter,
          crawlerUrls: args.crawler,
          fileId: args.archive,
          repeaters: args.repeater,
          optimizedCrawler: args.smart,
          poolSize: args.concurrency,
          maxInteractionsChainLength: args.interactionsDepth,
          subdomainsCrawl: args.crawlParentSubdomains,
          headers: args.header
        } as DiscoveryConfig
      );

      // eslint-disable-next-line no-console
      console.log(discoveryId);

      if (warnings?.length) {
        logger.warn(
          `${warnings.map((warning) => warning.message).join('\n')}\n`
        );
      }

      process.exit(0);
    } catch (error) {
      logger.error(
        ErrorMessageFactory.genericCommandError({
          error,
          command: 'discovery:run'
        })
      );
      process.exit(1);
    }
  }
}

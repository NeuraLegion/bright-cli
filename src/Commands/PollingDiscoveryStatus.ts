import { RestDiscoveryOptions } from 'src/Discovery';
import { DiscoveryPollingFactory } from 'src/Discovery/DiscoveryPollingFactory';
import { ErrorMessageFactory, logger } from 'src/Utils';
import { container } from 'tsyringe';
import { Arguments, Argv, CommandModule } from 'yargs';

export class PollingDiscoveryStatus implements CommandModule {
  public readonly command = 'discovery:polling [options] <discoveryId>';
  public readonly describe =
    'Allows to configure a polling of discovery status.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
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
      .option('interval', {
        requiresArg: true,
        describe:
          'The sampling interval between status checks. ' +
          'Eg: 60, "2min", "10h", "7d". A numeric value is interpreted as a milliseconds count.',
        default: 5000
      })
      .option('timeout', {
        requiresArg: true,
        describe:
          'Period of time between the end of a timeout period or completion of a discovery status request, and the next request for status. ' +
          'Eg: 60, "2min", "10h", "7d". A numeric value is interpreted as a milliseconds count.'
      })
      .positional('discoveryId', {
        describe: 'ID of an existing discovery.',
        demandOption: true,
        type: 'string'
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
      const pollingFactory = container.resolve<DiscoveryPollingFactory>(
        DiscoveryPollingFactory
      );
      const polling = pollingFactory.create({
        discoveryId: args.discoveryId as string,
        projectId: args.project as string,
        timeout: args.timeout as number,
        interval: args.interval as number
      });

      await polling.start();

      process.exit(0);
    } catch (error) {
      logger.error(
        ErrorMessageFactory.genericCommandError({
          error,
          command: 'discovery:polling'
        })
      );
      process.exit(1);
    }
  }
}

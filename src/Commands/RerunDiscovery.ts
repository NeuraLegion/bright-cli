import { Discoveries, RestDiscoveryOptions } from 'src/Discovery';
import { ErrorMessageFactory, logger } from 'src/Utils';
import { container } from 'tsyringe';
import { Arguments, Argv, CommandModule } from 'yargs';

export class RerunDiscovery implements CommandModule {
  public readonly command = 'discovery:rerun [options] <discoveryId>';
  public readonly describe =
    'Request to start a new discovery using the same configuration as an existing discovery, by discovery ID.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
        string: true,
        requiresArg: true,
        demandOption: true
      })
      .positional('discoveryId', {
        describe: 'ID of an existing discovery which you want to re-run.',
        requiresArg: true,
        demandOption: true,
        type: 'string'
      })
      .option('project', {
        alias: 'p',
        describe: 'ID of the project',
        string: true,
        requiresArg: true,
        demandOption: true
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

  public async handler(args: any): Promise<void> {
    try {
      const discoveryManager: Discoveries = container.resolve(Discoveries);
      const projectId = args.project as string;
      const discoveryId = args.discoveryId as string;
      const newDiscoveryId = await discoveryManager.rerun(
        projectId,
        discoveryId
      );

      // eslint-disable-next-line no-console
      console.log(newDiscoveryId);
      process.exit(0);
    } catch (error) {
      logger.error(
        ErrorMessageFactory.genericCommandError({
          error,
          command: 'discovery:rerun'
        })
      );
      process.exit(1);
    }
  }
}

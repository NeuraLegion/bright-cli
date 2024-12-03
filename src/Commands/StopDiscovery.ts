import { Discoveries, RestDiscoveryOptions } from '../Discovery';
import { ErrorMessageFactory, logger } from '../Utils';
import { container } from 'tsyringe';
import { Arguments, Argv, CommandModule } from 'yargs';

export class StopDiscovery implements CommandModule {
  public readonly command = 'discovery:stop [options] <discoveryId>';
  public readonly describe = 'Stop discovery by id.';

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
        requiresArg: true,
        string: true,
        describe: 'ID of the project',
        demandOption: true
      })
      .positional('discoveryId', {
        describe: 'ID of an existing discovery which you want to stop.',
        requiresArg: true,
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
      const discoveryManager: Discoveries = container.resolve(Discoveries);

      await discoveryManager.stop(
        args.project as string,
        args.discoveryId as string
      );
      process.exit(0);
    } catch (error) {
      logger.error(
        ErrorMessageFactory.genericCommandError({
          error,
          command: 'discovery:stop'
        })
      );
      process.exit(1);
    }
  }
}

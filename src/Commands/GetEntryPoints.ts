import { EntryPoint, EntryPoints, RestProjectsOptions } from '../EntryPoint';
import { logger } from '../Utils';
import { Arguments, Argv, CommandModule } from 'yargs';
import { container } from 'tsyringe';

export class GetEntryPoints implements CommandModule {
  public readonly command = 'entrypoints:list [options] <project>';
  public readonly describe = 'get all entrypoints of the project.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('verbose', {
        describe: 'Enable verbose mode',
        boolean: true,
        default: false
      })
      .positional('project', {
        describe: 'ID of the project',
        type: 'string',
        demandOption: true
      })
      .middleware((args: Arguments) =>
        container.register<RestProjectsOptions>(RestProjectsOptions, {
          useValue: {
            insecure: args.insecure as boolean,
            baseURL: args.api as string,
            apiKey: args.token as string,
            proxyURL: (args.proxyExternal ?? args.proxy) as string
          }
        })
      );
  }

  public async handler(args: Arguments): Promise<void> {
    const entryPointsManager: EntryPoints = container.resolve(EntryPoints);

    try {
      const entryPoints: EntryPoint[] = await entryPointsManager.entrypoints(
        args.project as string
      );

      if (args.verbose) {
        // eslint-disable-next-line no-console
        console.log('%j', entryPoints);
      } else {
        // eslint-disable-next-line no-console
        console.log(
          '%j',
          entryPoints.map((entryPoint) => ({
            id: entryPoint.id,
            method: entryPoint.method,
            url: entryPoint.url
          }))
        );
      }

      process.exitCode = 0;
    } catch (e) {
      logger.error(`Error during "entrypoints:list": ${e.error || e.message}`);
      process.exitCode = 1;
    }
  }
}

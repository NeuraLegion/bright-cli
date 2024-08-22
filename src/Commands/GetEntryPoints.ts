import { EntryPoint, EntryPoints, RestProjectsOptions } from '../EntryPoint';
import { logger } from '../Utils';
import { Arguments, Argv, CommandModule } from 'yargs';
import { container } from 'tsyringe';

export class GetEntryPoints implements CommandModule {
  public readonly command = 'entrypoints:list [options]';
  public readonly describe = 'get all entrypoints of the project.';

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
        requiresArg: true,
        demandOption: true
      })
      .option('verbose', {
        describe: 'Enable verbose mode',
        boolean: true,
        default: false
      })
      .option('limit', {
        describe: 'Limit the number of entrypoints',
        default: 10
      })
      .option('pretty', {
        describe: 'Pretty print the output',
        boolean: true,
        default: false
      })
      .option('connectivity', {
        describe: 'Filter by connectivity',
        array: true,
        choices: [
          'ok',
          'unreachable',
          'problem',
          'skipped',
          'unauthorized',
          'unavailable'
        ]
      })
      .option('status', {
        describe: 'Filter by status',
        array: true,
        choices: ['new', 'changed', 'tested', 'vulnerable']
      })
      .middleware((args: Arguments) =>
        container.register<RestProjectsOptions>(RestProjectsOptions, {
          useValue: {
            insecure: args.insecure as boolean,
            baseURL: args.api as string,
            apiKey: args.token as string,
            proxyURL: (args.proxyBright ?? args.proxy) as string
          }
        })
      );
  }

  public async handler(args: Arguments): Promise<void> {
    const entryPointsManager: EntryPoints = container.resolve(EntryPoints);

    try {
      const entryPoints: EntryPoint[] = await entryPointsManager.entrypoints({
        projectId: args.project as string,
        limit: args.limit as number,
        connectivity: args.connectivity as string[],
        status: args.status as string[]
      });

      const ep = args.verbose
        ? entryPoints.map((entryPoint) => ({
            id: entryPoint.id,
            method: entryPoint.method,
            url: entryPoint.url
          }))
        : entryPoints;

      // eslint-disable-next-line no-console
      console.log(
        args.pretty ? JSON.stringify(ep, null, 4) : JSON.stringify(ep)
      );

      process.exitCode = 0;
    } catch (e) {
      logger.error(`Error during "entrypoints:list": ${e.error || e.message}`);
      process.exitCode = 1;
    }
  }
}

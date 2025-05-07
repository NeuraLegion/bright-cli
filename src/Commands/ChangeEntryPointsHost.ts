import { logger } from '../Utils';
import { EntryPoints, RestProjectsOptions } from '../EntryPoint';
import { Arguments, Argv, CommandModule } from 'yargs';
import { container } from 'tsyringe';

export class ChangeEntryPointsHost implements CommandModule {
  public readonly command = 'entrypoints:change-host [options]';
  public readonly describe =
    'Change host for specified entry points in the project';

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
      .option('new-host', {
        describe: 'New host URL',
        requiresArg: true,
        demandOption: true,
        type: 'string'
      })
      .option('old-host', {
        describe: 'Old host URL to replace',
        requiresArg: true,
        type: 'string'
      })
      .option('entrypoint-ids', {
        describe: 'List of entry point IDs to update',
        type: 'array'
      })
      .option('verbose', {
        describe: 'Enable verbose mode',
        boolean: true,
        default: false
      })
      .middleware((args: Arguments) =>
        container.register<RestProjectsOptions>(RestProjectsOptions, {
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
      const entryPoints = container.resolve<EntryPoints>(EntryPoints);

      await entryPoints.changeHost({
        projectId: args.project as string,
        newHost: args.newHost as string,
        oldHost: args.oldHost as string,
        entryPointIds: args.entrypointIds as string[]
      });

      logger.log('info', 'Successfully changed entry points host');
      process.exit(0);
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error('An unknown error occurred');
      }
      process.exit(1);
    }
  }
}

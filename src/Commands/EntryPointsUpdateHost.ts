import { ErrorMessageFactory, logger } from '../Utils';
import {
  EntryPoints,
  RestProjectsOptions,
  UpdateHostOptions
} from '../EntryPoint';
import { container } from 'tsyringe';
import { Arguments, Argv, CommandModule } from 'yargs';

export class EntryPointsUpdateHost implements CommandModule {
  public readonly command = 'entrypoints:update-host [options]';
  public readonly describe = 'Bulk update target entry points host.';

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
      .option('old-hostname', {
        alias: 'o',
        describe: 'Old hostname of entrypoints.',
        string: true,
        requiresArg: true,
        demandOption: true
      })
      .option('new-hostname', {
        alias: 'n',
        describe: 'New hostname of entrypoints.',
        string: true,
        requiresArg: true,
        demandOption: true
      })
      .option('entrypoint-ids', {
        alias: 'e',
        describe: 'IDs of entrypoints to update.',
        string: true,
        requiresArg: true,
        array: true
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
      const entryPointsManager: EntryPoints = container.resolve(EntryPoints);

      const projectId = args.project as string;

      const { taskId } = await entryPointsManager.updateHost({
        projectId,
        entryPointIds: args.entrypointIds as undefined | string[],
        newHostname: args.newHostname as string,
        oldHostname: args.oldHostname as string
      } as UpdateHostOptions);

      // eslint-disable-next-line no-console
      console.log(taskId);

      process.exitCode = 0;
    } catch (error) {
      logger.error(
        ErrorMessageFactory.genericCommandError({
          error,
          command: 'entrypoints:update-host'
        })
      );
      process.exitCode = 1;
    }
  }
}

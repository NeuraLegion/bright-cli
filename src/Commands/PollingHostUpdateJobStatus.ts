import { ErrorMessageFactory, logger } from '../Utils';
import { HostUpdateJobStatusPollingFactory } from '../EntryPoint/HostUpdateJobStatusPollingFactory';
import { RestProjectsOptions } from '../EntryPoint';
import { Arguments, Argv, CommandModule } from 'yargs';
import { container } from 'tsyringe';

export class PollingHostUpdateJobStatus implements CommandModule {
  public readonly command = 'entrypoints:update-host-polling [options] <jobId>';
  public readonly describe =
    'Allows to configure a polling of host update job status.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('interval', {
        requiresArg: true,
        describe:
          'Period of time between the end of a timeout period or completion of a host update job status request, and the next request for status. ' +
          'Eg: 60, "2min", "10h", "7d". A numeric value is interpreted as a milliseconds count.',
        default: 5000
      })
      .option('timeout', {
        requiresArg: true,
        describe:
          'Period of time between the end of a timeout period or completion of a host update job status request, and the next request for status. ' +
          'Eg: 60, "2min", "10h", "7d". A numeric value is interpreted as a milliseconds count.'
      })
      .option('project', {
        alias: 'p',
        describe: 'ID of the project',
        string: true,
        requiresArg: true,
        demandOption: true
      })
      .positional('jobId', {
        describe: 'ID of an existing update host job which you want to check.',
        type: 'string',
        demandOption: true
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
      const pollingFactory =
        container.resolve<HostUpdateJobStatusPollingFactory>(
          HostUpdateJobStatusPollingFactory
        );
      const polling = pollingFactory.create({
        timeout: args.timeout as number,
        interval: args.interval as number,
        jobId: args.jobId as string,
        projectId: args.project as string
      });

      await polling.start();

      process.exit(0);
    } catch (error) {
      logger.error(
        ErrorMessageFactory.genericCommandError({
          error,
          command: 'entrypoints:update-host-polling'
        })
      );
      process.exit(1);
    }
  }
}

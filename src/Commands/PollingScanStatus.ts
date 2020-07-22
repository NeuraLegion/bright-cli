import {
  FailureError,
  FailureOnType,
  FailureStrategyFactory,
  ServicesApiFactory
} from '../Strategy';
import { Arguments, Argv, CommandModule } from 'yargs';

export class PollingScanStatus implements CommandModule {
  public readonly command = 'scan:polling [options] <scan>';
  public readonly describe = 'Allows to configure a polling of scan status.';

  public builder(args: Argv): Argv {
    return args
      .option('api', {
        default: 'https://nexploit.app/',
        hidden: true,
        describe: 'NexPloit base url'
      })
      .option('api-key', {
        alias: 'K',
        describe: 'NexPloit API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('interval', {
        requiresArg: true,
        describe:
          'Period of time between the end of a timeout period or completion of a scan status request, and the next request for status. ' +
          'Eg: 60, "2min", "10h", "7d". A numeric value is interpreted as a milliseconds count.',
        default: 5000
      })
      .option('timeout', {
        requiresArg: true,
        describe:
          'Period of time between the end of a timeout period or completion of a scan status request, and the next request for status. ' +
          'Eg: 60, "2min", "10h", "7d". A numeric value is interpreted as a milliseconds count.'
      })
      .option('failure-on', {
        choices: [
          'first-issue',
          'first-medium-severity-issue',
          'first-high-severity-issue'
        ],
        string: true,
        describe:
          'Predefined failure strategy that allows to finish process with exit code 50 only after fulfilling the condition.',
        requiresArg: true,
        default: 'first-issue'
      })
      .positional('scan', {
        describe: 'ID of an existing scan which you want to check.',
        type: 'string',
        demandOption: true
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      await new ServicesApiFactory(args.api as string, args.apiKey as string)
        .createPolling({
          scanId: args.scan as string,
          interval: args.interval as number,
          timeout: args.timeout as number
        })
        .check(
          new FailureStrategyFactory().create(args.failureOn as FailureOnType)
        );

      process.exit(0);
    } catch (e) {
      if (e instanceof FailureError) {
        console.error(`Scan failure during "scan:polling": ${e.message}`);
        process.exit(50);

        return;
      }

      console.error(`Error during "scan:polling" run: ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

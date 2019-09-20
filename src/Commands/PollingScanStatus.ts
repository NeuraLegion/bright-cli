import * as yargs from 'yargs';
import { Discovery, ScanManager } from '../Strategy/ScanManager';
import { InlineHeaders } from '../Parsers/InlineHeaders';

import { FailureStrategyFactory } from '../Strategy/Failure/FailureStrategyFactory';
import { FailureOnType, Polling } from '../Strategy/Failure/Polling';
import { FailureError } from '../Strategy/Failure/FailureError';
import { ServicesApiFactory } from '../Strategy/ServicesApiFactory';

export class PollingScanStatus implements yargs.CommandModule {
  public readonly command = 'scan:polling [options] <scan>';
  public readonly describe = 'Allows to configure a polling of scan status.';

  public builder(args: yargs.Argv): yargs.Argv {
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
        number: true,
        requiresArg: true,
        describe:
          'Period of time between the end of a timeout period or completion of a scan status request, and the next request for status.',
        default: 5000
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
        describe: 'ID of an existing scan which you want to re-run.',
        type: 'string',
        demandOption: true
      });
  }

  public async handler(args: yargs.Arguments): Promise<void> {
    try {
      await new ServicesApiFactory(args.api as string, args.apiKey as string)
        .CreatePolling({
          scanId: args.scan as string,
          poolingInterval: args.interval as number
        })
        .check(
          new FailureStrategyFactory().Create(args.failureOn as FailureOnType)
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

import {
  BreakpointException,
  BreakpointType,
  DefaultBreakpointFactory,
  DefaultPolling,
  RestScans
} from '../Scan';
import { Helpers, logger } from '../Utils';
import { Arguments, Argv, CommandModule } from 'yargs';

export class PollingScanStatus implements CommandModule {
  public readonly command = 'scan:polling [options] <scan>';
  public readonly describe = 'Allows to configure a polling of scan status.';

  public builder(args: Argv): Argv {
    return args
      .option('token', {
        alias: 't',
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
      .option('breakpoint', {
        alias: 'b',
        choices: Helpers.toArray(BreakpointType),
        string: true,
        describe:
          'A conditional breakpoint that allows to finish the process with exit code 50 only after fulfilling the predefined condition.',
        requiresArg: true,
        default: BreakpointType.ANY
      })
      .positional('scan', {
        describe: 'ID of an existing scan which you want to check.',
        type: 'string',
        demandOption: true
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const scanManager = new RestScans({
        baseUrl: args.api as string,
        apiKey: args.token as string,
        proxyUrl: args.proxy as string
      });
      const polling = new DefaultPolling({
        scanManager,
        scanId: args.scan as string,
        timeout: args.timeout as number,
        interval: args.interval as number
      });
      const breakpointFactory = new DefaultBreakpointFactory();

      await polling.start(
        breakpointFactory.create(args.breakpoint as BreakpointType)
      );

      process.exit(0);
    } catch (e) {
      if (e instanceof BreakpointException) {
        logger.error(`The breakpoint has been hit during polling.`);
        logger.error(`Breakpoint: ${e.message}`);
        process.exit(50);

        return;
      }

      logger.error(`Error during "scan:polling": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

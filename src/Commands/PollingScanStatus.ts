import {
  BreakpointException,
  BreakpointType,
  PollingFactory,
  RestScansOptions
} from '../Scan';
import { Helpers, logger } from '../Utils';
import { Arguments, Argv, CommandModule } from 'yargs';
import { container } from 'tsyringe';

export class PollingScanStatus implements CommandModule {
  public readonly command = 'scan:polling [options] <scan>';
  public readonly describe = 'Allows to configure a polling of scan status.';

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
      })
      .middleware((args: Arguments) =>
        container.register<RestScansOptions>(RestScansOptions, {
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
    try {
      const pollingFactory = container.resolve<PollingFactory>(PollingFactory);
      const polling = pollingFactory.create({
        scanId: args.scan as string,
        timeout: args.timeout as number,
        interval: args.interval as number,
        breakpoint: args.breakpoint as BreakpointType
      });

      await polling.start();

      process.exit(0);
    } catch (e) {
      if (e instanceof BreakpointException) {
        logger.error(`The breakpoint has been hit during polling.`);
        logger.error(`Breakpoint: ${e.message}`);
        process.exit(50);
      }

      logger.error(`Error during "scan:polling": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

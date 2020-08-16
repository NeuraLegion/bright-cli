import {
  BreakpointException,
  BreakpointType,
  DefaultBreakpointFactory,
  DefaultPolling,
  RestScans
} from '../Scan';
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
      .option('proxy', {
        describe: 'SOCKS4 or SOCKS5 url to proxy all traffic'
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
      const scanManager = new RestScans({
        baseUrl: args.api as string,
        apiKey: args.apiKey as string,
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
        console.error(
          `The breakpoint has been hit during "scan:polling": ${e.message}`
        );
        process.exit(50);

        return;
      }

      console.error(`Error during "scan:polling": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

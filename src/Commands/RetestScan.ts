import { RestScans } from '../Scan';
import logger from '../Utils/Logger';
import { Arguments, Argv, CommandModule } from 'yargs';

export class RetestScan implements CommandModule {
  public readonly command = 'scan:retest [options] <scan>';
  public readonly describe =
    'Request to start a new scan using the same configuration as an existing scan, by scan ID.';

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
      .positional('scan', {
        describe: 'ID of an existing scan which you want to re-run.',
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

      const scanId: string = await scanManager.retest(args.scan as string);

      logger.log(scanId);

      process.exit(0);
    } catch (e) {
      logger.error(`Error during "scan:retest": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

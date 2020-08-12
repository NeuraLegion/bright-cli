import { FailureError, ServicesApiFactory } from '../Strategy';
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
      const scanId: string = await new ServicesApiFactory(
        args.api as string,
        args.apiKey as string,
        args.proxy as string
      )
        .createScanManager()
        .retest(args.scan as string);

      console.log(scanId);

      process.exit(0);
    } catch (e) {
      if (e instanceof FailureError) {
        console.error(`Scan failure during "scan:run": ${e.message}`);
        process.exit(50);

        return;
      }

      console.error(`Error during "scan:run" run: ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

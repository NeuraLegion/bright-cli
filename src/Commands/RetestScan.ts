import yargs from 'yargs';
import { FailureError } from '../Strategy/Failure/FailureError';
import { ServicesApiFactory } from '../Strategy/ServicesApiFactory';

export class RetestScan implements yargs.CommandModule {
  public readonly command = 'scan:retest [options] <scan>';
  public readonly describe =
    'Request to start a new scan using the same configuration as an existing scan, by scan ID.';

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
      .positional('scan', {
        describe: 'ID of an existing scan which you want to re-run.',
        type: 'string',
        demandOption: true
      });
  }

  public async handler(args: yargs.Arguments): Promise<void> {
    try {
      const scanId: string = await new ServicesApiFactory(
        args.api as string,
        args.apiKey as string
      )
        .CreateScanManager()
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

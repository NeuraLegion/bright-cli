import * as yargs from 'yargs';
import { FailureError } from '../Strategy/Failure/FailureError';
import { ServicesApiFactory } from '../Strategy/ServicesApiFactory';

export class StopScan implements yargs.CommandModule {
  public readonly command = 'scan:stop [options] <scan>';
  public readonly describe = 'Stop scan by id.';

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
        describe: 'ID of an existing scan which you want to stop.',
        type: 'string'
      });
  }

  public async handler(args: yargs.Arguments): Promise<void> {
    try {
      await new ServicesApiFactory(args.api as string, args.apiKey as string)
        .CreateScanManager()
        .stop(args.scan as string);

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

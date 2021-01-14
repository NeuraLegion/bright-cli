import { RestScans } from '../Scan';
import { logger } from '../Utils';
import { Arguments, Argv, CommandModule } from 'yargs';

export class StopScan implements CommandModule {
  public readonly command = 'scan:stop [options] <scan>';
  public readonly describe = 'Stop scan by id.';

  public builder(args: Argv): Argv {
    return args
      .option('token', {
        alias: 't',
        describe: 'NexPloit API-key',
        requiresArg: true,
        demandOption: true
      })
      .positional('scan', {
        describe: 'ID of an existing scan which you want to stop.',
        requiresArg: true,
        demandOption: true,
        type: 'string'
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const scanManager = new RestScans({
        baseUrl: args.api as string,
        apiKey: args.token as string,
        proxyUrl: args.proxy as string
      });

      await scanManager.stop(args.scan as string);

      process.exit(0);
    } catch (e) {
      logger.error(`Error during "scan:stop": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

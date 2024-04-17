import { RestScansOptions, Scans } from '../Scan';
import { logger } from '../Utils';
import { Arguments, Argv, CommandModule } from 'yargs';
import { container } from 'tsyringe';

export class StopScan implements CommandModule {
  public readonly command = 'scan:stop [options] <scan>';
  public readonly describe = 'Stop scan by id.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
        requiresArg: true,
        demandOption: true
      })
      .positional('scan', {
        describe: 'ID of an existing scan which you want to stop.',
        requiresArg: true,
        demandOption: true,
        type: 'string'
      })
      .middleware((args: Arguments) =>
        container.register<RestScansOptions>(RestScansOptions, {
          useValue: {
            insecure: args.insecure as boolean,
            baseURL: args.api as string,
            apiKey: args.token as string,
            proxyURL: (args.proxyExternal ?? args.proxy) as string
          }
        })
      );
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const scanManager: Scans = container.resolve(Scans);

      await scanManager.stop(args.scan as string);

      process.exit(0);
    } catch (e) {
      logger.error(`Error during "scan:stop": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

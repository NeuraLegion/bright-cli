import { RestScansOptions, Scans } from '../Scan';
import { logger } from '../Utils';
import { Arguments, Argv, CommandModule } from 'yargs';
import { container } from 'tsyringe';

export class RetestScan implements CommandModule {
  public readonly command = 'scan:retest [options] <scan>';
  public readonly describe =
    'Request to start a new scan using the same configuration as an existing scan, by scan ID.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'NexPloit API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('insecure', {
        type: 'boolean',
        default: false,
        description:
          'Allows CLI to proceed and operate even for server connections otherwise considered insecure.'
      })
      .positional('scan', {
        describe: 'ID of an existing scan which you want to re-run.',
        type: 'string',
        demandOption: true
      })
      .middleware((args: Arguments) =>
        container.register(RestScansOptions, {
          useValue: {
            insecure: args.insecure as boolean,
            baseUrl: args.api as string,
            apiKey: args.token as string,
            proxyUrl: args.proxy as string
          }
        })
      );
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const scanManager: Scans = container.resolve(Scans);
      const scanId: string = await scanManager.retest(args.scan as string);

      logger.log(scanId);

      process.exit(0);
    } catch (e) {
      logger.error(`Error during "scan:retest": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

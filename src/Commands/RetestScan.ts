import { RestScansOptions, Scans } from '../Scan';
import { ErrorMessageBuilder, logger } from '../Utils';
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
        describe: 'Bright API-key',
        requiresArg: true,
        demandOption: true
      })
      .positional('scan', {
        describe: 'ID of an existing scan which you want to re-run.',
        type: 'string',
        demandOption: true
      })
      .middleware((args: Arguments) =>
        container.register<RestScansOptions>(RestScansOptions, {
          useValue: {
            insecure: args.insecure as boolean,
            baseURL: args.api as string,
            apiKey: args.token as string,
            proxyURL: (args.proxyBright ?? args.proxy) as string,
            timeout: args.timeout as number
          }
        })
      );
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const scanManager: Scans = container.resolve(Scans);
      const scanId: string = await scanManager.retest(args.scan as string);

      // eslint-disable-next-line no-console
      console.log(scanId);

      process.exit(0);
    } catch (error) {
      logger.error(
        ErrorMessageBuilder.buildMessage({ command: 'scan:retest', error })
      );
      process.exit(1);
    }
  }
}

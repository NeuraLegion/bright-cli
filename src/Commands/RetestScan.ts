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
      .option('name', {
        alias: 'n',
        describe: 'Name of the scan.',
        string: false,
        demandOption: false
      })
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('template', {
        alias: 'tp',
        requiresArg: false,
        string: true,
        describe: 'ID of the template'
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
            baseUrl: args.api as string,
            apiKey: args.token as string,
            proxyUrl: (args.proxyExternal ?? args.proxy) as string
          }
        })
      );
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      if (!args.name && args.template) {
        throw Error('please make sure that name is specified.');
      }

      const body = args.name && {
        templateId: args.template as string,
        name: args.name as string
      };

      const scanManager: Scans = container.resolve(Scans);
      const scanId: string = await scanManager.retest(
        args.scan as string,
        body
      );

      // eslint-disable-next-line no-console
      console.log(scanId);

      process.exit(0);
    } catch (e) {
      logger.error(`Error during "scan:retest": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

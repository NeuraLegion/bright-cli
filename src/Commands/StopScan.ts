import { RestScans } from '../Scan';
import { Arguments, Argv, CommandModule } from 'yargs';

export class StopScan implements CommandModule {
  public readonly command = 'scan:stop [options] <scan>';
  public readonly describe = 'Stop scan by id.';

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
        describe: 'ID of an existing scan which you want to stop.',
        type: 'string'
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const scanManager = new RestScans({
        baseUrl: args.api as string,
        apiKey: args.apiKey as string,
        proxyUrl: args.proxy as string
      });

      await scanManager.stop(args.scan as string);

      process.exit(0);
    } catch (e) {
      console.error(`Error during "scan:run" run: ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

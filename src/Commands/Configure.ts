import logger from '../Utils/Logger';
import { Arguments, Argv, CommandModule } from 'yargs';
import { ConnectivityWizard } from '../ConnectivityWizard/ConnectivityWizard';

export class Configure implements CommandModule {
  public readonly command = 'configure';
  public readonly describe = 'Start a configuration wizard';

  public builder(args: Argv): Argv {
    return args.option('bus', {
      default: 'amq.nexploit.app',
      demandOption: false,
      describe: 'NexPloit Event Bus for connectivity test'
    });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      console.log(args.bus);
      new ConnectivityWizard(args.bus as string);
    } catch (e) {
      logger.error(`Error during "configure": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

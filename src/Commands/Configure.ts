import logger from '../Utils/Logger';
import { ConnectivityWizard } from '../ConnectivityWizard/ConnectivityWizard';
import { Argv, CommandModule } from 'yargs';

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

  public async handler(/*args: Arguments*/): Promise<void> {
    try {
      // await new ConnectivityWizard().init(args.bus as string);
      await new ConnectivityWizard().init();
    } catch (e) {
      logger.error(`Error during "configure": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

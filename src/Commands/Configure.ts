import logger from '../Utils/Logger';
import { Argv, CommandModule } from 'yargs';
import { ConnectivityWizard } from '../ConnectivityWizard/ConnectivityWizard';

export class Configure implements CommandModule {
  public readonly command = 'configure';
  public readonly describe = 'Start a configuration wizard';

  public builder(args: Argv): Argv {
    return args;
  }

  public async handler(): Promise<void> {
    try {
      new ConnectivityWizard();
    } catch (e) {
      logger.error(`Error during "configure": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

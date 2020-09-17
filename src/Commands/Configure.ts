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
      // const scanManager = new RestScans({
      //   baseUrl: args.api as string,
      //   apiKey: args.token as string,
      //   proxyUrl: args.proxy as string
      // });

      // const scanId: string = await scanManager.create({
      //   name: args.name,
      //   module: args.module,
      //   tests: args.test,
      //   hostsFilter: args.hostFilter,
      //   headers: Helpers.parseHeaders(args.header as string[]),
      //   crawlerUrls: args.crawler,
      //   fileId: args.archive,
      //   agents: args.agent,
      //   smart: args.smart,
      //   attackParamLocations: args.param,
      //   build: args.service
      //     ? {
      //         service: args.service,
      //         buildNumber: args.buildNumber,
      //         project: args.project,
      //         user: args.user,
      //         vcs: args.vcs
      //       }
      //     : undefined
      // } as ScanConfig);

      // logger.log(scanId);

      new ConnectivityWizard();
      
      logger.log('gil2');
      // process.exit(0);
    } catch (e) {
      logger.error(`Error during "configure": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

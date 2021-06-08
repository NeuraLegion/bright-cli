import { Helpers, logger } from '../Utils';
import { ConnectivityUrls, Platform, TestType } from '../Wizard';
import { container } from '../Config';
import { Arguments, Argv, CommandModule } from 'yargs';
import { URL } from 'url';

export class Configure implements CommandModule {
  public readonly command = 'configure [options]';
  public readonly describe = 'Start a configuration wizard';

  public builder(argv: Argv): Argv {
    return argv
      .option(TestType.TCP, {
        hidden: true,
        describe: `NexPloit Event Bus for connectivity test`
      })
      .option(TestType.HTTP, {
        hidden: true,
        describe: `NexPloit application for connectivity test`
      })
      .option(TestType.AUTH, {
        hidden: true,
        describe: `NexPloit event message authentication endpoint`
      })
      .option('nogui', {
        default: true,
        deprecated: true,
        boolean: true,
        describe: `Start a configuration wizard without GUI`
      })
      .option('network-only', {
        default: false,
        boolean: true,
        hidden: true,
        describe: `Enables network tests only`
      })
      .middleware((args: Arguments) => {
        const { api, bus } = Helpers.getClusterUrls(args);

        container.register(ConnectivityUrls, {
          useValue: new Map(
            Object.values(TestType).map((type: TestType) => {
              try {
                switch (type) {
                  case TestType.TCP:
                    return [type, new URL((args[type] as string) ?? bus)];
                  case TestType.AUTH:
                    return [
                      type,
                      new URL(
                        (args[type] as string) ?? `${api}/v1/repeaters/user`
                      )
                    ];
                  case TestType.HTTP:
                    return [type, new URL((args[type] as string) ?? api)];
                  default:
                    throw new Error(
                      `Testing endpoint of type${type} not supported`
                    );
                }
              } catch (err) {
                throw new Error(`Invalid value for ${type} testing endpoint`);
              }
            })
          )
        });
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const app = container.resolve<Platform>(Platform);

      const stop: () => void = () => {
        app.stop();
        process.exit(0);
      };

      process.on('SIGTERM', stop).on('SIGINT', stop).on('SIGHUP', stop);
      await app.start({ networkTestOnly: !!args.networkOnly });
    } catch (e) {
      logger.error(`Error during "configure": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

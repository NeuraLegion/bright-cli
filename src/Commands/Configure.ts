import { logger } from '../Utils';
import { ConnectivityUrls, Platform, TestType } from '../Wizard';
import { container } from '../Config';
import { Arguments, Argv, CommandModule } from 'yargs';
import { URL } from 'url';

export class Configure implements CommandModule {
  public readonly command = 'configure [options]';
  public readonly describe = 'Start a configuration wizard';

  private static getMapEntryOrThrow(
    type: TestType,
    input: string
  ): [TestType, URL] {
    try {
      return [type, new URL(input)];
    } catch (err) {
      throw new Error(`Invalid value for ${type} testing endpoint`);
    }
  }

  public builder(argv: Argv): Argv {
    return argv
      .option(TestType.TCP, {
        hidden: true,
        requiresArg: true,
        describe: `NexPloit Event Bus for connectivity test`
      })
      .option(TestType.HTTP, {
        hidden: true,
        requiresArg: true,
        describe: `NexPloit application for connectivity test`
      })
      .option(TestType.AUTH, {
        hidden: true,
        requiresArg: true,
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
        container.register(ConnectivityUrls, {
          useValue: new Map([
            Configure.getMapEntryOrThrow(
              TestType.TCP,
              (args[TestType.TCP] ?? args.bus) as string
            ),
            Configure.getMapEntryOrThrow(
              TestType.HTTP,
              (args[TestType.HTTP] ?? args.api) as string
            ),
            Configure.getMapEntryOrThrow(
              TestType.AUTH,
              (args[TestType.AUTH] ?? `${args.api}/v1/repeaters/user`) as string
            )
          ])
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

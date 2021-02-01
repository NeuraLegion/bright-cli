import { logger } from '../Utils';
import { ConnectivityUrls, KoaPlatform, Platform, TestType } from '../Wizard';
import { container } from '../Config';
import { Arguments, Argv, CommandModule } from 'yargs';
import { Lifecycle } from 'tsyringe';
import { ReadlinePlatform } from 'src/Wizard/Platform/Readline';
import { URL } from 'url';

export class Configure implements CommandModule {
  private static readonly DEFAULT_TCP_TEST_ENDPOINT: string =
    'amqps://amq.nexploit.app:5672';
  private static readonly DEFAULT_HTTP_TEST_ENDPOINT: string =
    'https://nexploit.app:443';
  private static readonly DEFAULT_AUTH_TEST_ENDPOINT: string =
    'https://nexploit.app/api/v1/repeaters/user';

  public readonly command = 'configure [options]';
  public readonly describe = 'Start a configuration wizard';

  public builder(argv: Argv): Argv {
    return argv
      .option(TestType.TCP, {
        default: Configure.DEFAULT_TCP_TEST_ENDPOINT,
        hidden: true,
        describe: `NexPloit Event Bus for connectivity test`
      })
      .option(TestType.HTTP, {
        default: Configure.DEFAULT_HTTP_TEST_ENDPOINT,
        hidden: true,
        describe: `NexPloit application for connectivity test`
      })
      .option(TestType.AUTH, {
        default: Configure.DEFAULT_AUTH_TEST_ENDPOINT,
        hidden: true,
        describe: `NexPloit event message authentication endpoint`
      })
      .option('nogui', {
        default: false,
        boolean: true,
        describe: `Start a configuration wizard without GUI`
      })
      .middleware((args: Arguments) => {
        container.register(ConnectivityUrls, {
          useValue: new Map(
            Object.values(TestType).map((type: TestType) => {
              try {
                return [type, new URL(args[type] as string)];
              } catch (err) {
                throw new Error(`Invalid value for ${type} testing endpoint`);
              }
            })
          )
        });

        if (args.nogui) {
          container.register(
            Platform,
            { useClass: ReadlinePlatform },
            { lifecycle: Lifecycle.Singleton }
          );
        } else {
          container.register(
            Platform,
            { useClass: KoaPlatform },
            { lifecycle: Lifecycle.Singleton }
          );
        }
      });
  }

  public async handler(): Promise<void> {
    try {
      const app = await container.resolve<Platform>(Platform).start();

      const stop: () => void = () => {
        app.stop();
        process.exit(0);
      };

      process.on('SIGTERM', stop).on('SIGINT', stop).on('SIGHUP', stop);
    } catch (e) {
      logger.error(`Error during "configure": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

import logger from '../Utils/Logger';
import { KoaPlatform, TestType } from '../Wizard';
import { Arguments, Argv, CommandModule } from 'yargs';
import { URL } from 'url';

export class Configure implements CommandModule {
  private static readonly DEFAULT_TCP_TEST_ENDPOINT: string =
    'amqps://amq.nexploit.app:5672';
  private static readonly DEFAULT_HTTP_TEST_ENDPOINT: string =
    'https://nexploit.app:443';
  private static readonly DEFAULT_AUTH_TEST_ENDPOINT: string =
    'https://nexploit.app/api/v1/repeaters/user';

  public readonly command = 'configure';
  public readonly describe = 'Start a configuration wizard';

  public builder(args: Argv): Argv {
    return args
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
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const options: Map<TestType, URL> = new Map(
        Object.values(TestType).map((type: TestType) => {
          try {
            return [type, new URL(args[type] as string)];
          } catch (err) {
            throw new Error(`Invalid value for ${type} testing endpoint`);
          }
        })
      );

      const app = await new KoaPlatform(options).start();

      const stop: () => void = () => {
        app.close();
        process.exit(0);
      };

      process.on('SIGTERM', stop).on('SIGINT', stop).on('SIGHUP', stop);
    } catch (e) {
      logger.error(`Error during "configure": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

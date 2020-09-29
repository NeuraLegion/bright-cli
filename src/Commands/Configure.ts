import logger from '../Utils/Logger';
import { ConnectivityWizard } from '../ConnectivityWizard/ConnectivityWizard';
import { Arguments, Argv, CommandModule } from 'yargs';
import { TestType } from 'src/ConnectivityWizard/Entities/ConnectivityTest';
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
      .option('tcp-test', {
        default: Configure.DEFAULT_TCP_TEST_ENDPOINT,
        demandOption: false,
        describe: `NexPloit Event Bus for connectivity test (e.g. ${Configure.DEFAULT_TCP_TEST_ENDPOINT})`
      })
      .option('http-test', {
        default: Configure.DEFAULT_HTTP_TEST_ENDPOINT,
        demandOption: false,
        describe: `NexPloit application for connectivity test (e.g. ${Configure.DEFAULT_HTTP_TEST_ENDPOINT})`
      })
      .option('auth-test', {
        default: Configure.DEFAULT_AUTH_TEST_ENDPOINT,
        demandOption: false,
        describe: `NexPloit event message authentication endpoint (e.g. ${Configure.DEFAULT_AUTH_TEST_ENDPOINT})`
      });
  }

  public async handler(args: Arguments): Promise<void> {
    try {
      const options: Map<TestType, URL> = new Map();
      try {
        options.set('tcp', new URL(args['tcp-test'] as string));
      } catch (err) {
        logger.log('Invalid value for TCP testing endpoint');
        process.exit(1);
      }

      try {
        options.set('http', new URL(args['http-test'] as string));
      } catch (err) {
        logger.log('Invalid value for HTTP testing endpoint');
        process.exit(1);
      }

      try {
        options.set('auth', new URL(args['auth-test'] as string));
      } catch (err) {
        logger.log('Invalid value for authentication testing endpoint');
        process.exit(1);
      }

      await new ConnectivityWizard().init(options);
    } catch (e) {
      logger.error(`Error during "configure": ${e.error || e.message}`);
      process.exit(1);
    }
  }
}

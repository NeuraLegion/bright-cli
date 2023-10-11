import { container } from '../Config';
import { Bus, RabbitMQBusOptions } from '../Bus';
import {
  ConnectivityStatus,
  IntegrationClient,
  IntegrationPingTracer,
  IntegrationOptions
} from '../Integrations';
import { Helpers, logger } from '../Utils';
import { StartupManager } from '../StartupScripts';
import {
  RequestProjectsHandler,
  RegisterIssueHandler,
  IntegrationConnected,
  NetworkTestHandler
} from '../Handlers';
import { Arguments, Argv, CommandModule } from 'yargs';
import Timer = NodeJS.Timer;

let timer: Timer;

export class Integration implements CommandModule {
  private static SERVICE_NAME = 'bright-integration';
  public readonly command = 'integration [options]';
  public readonly describe = 'Starts an on-prem integration.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('type', {
        choices: ['jira'],
        requiresArg: true,
        default: 'jira',
        describe: 'Integration service type'
      })
      .option('access-key', {
        describe: 'Integration service key',
        requiresArg: true,
        demandOption: true
      })
      .option('base-url', {
        default: 'http://localhost:8080',
        demandOption: true,
        describe: 'The base URL to the Jira instance API'
      })
      .option('timeout', {
        number: true,
        requiresArg: true,
        default: 10000,
        describe:
          'Time to wait for a server to send response headers (and start the response body) before aborting the request.'
      })
      .option('user', {
        alias: 'u',
        describe:
          'Use username for Jira Server or email for Jira on Atlassian cloud.',
        requiresArg: true,
        demandOption: true
      })
      .option('password', {
        alias: 'p',
        describe:
          'Use password for Jira Server or API token for Jira on Atlassian cloud.',
        requiresArg: true,
        demandOption: true
      })
      .option('daemon', {
        requiresArg: false,
        alias: 'd',
        describe: 'Run integration in daemon mode'
      })
      .option('remove-daemon', {
        requiresArg: false,
        alias: ['rm', 'remove'],
        describe: 'Stop and remove integration daemon'
      })
      .option('run', {
        requiresArg: false,
        hidden: true
      })
      .conflicts('remove-daemon', 'daemon')
      .middleware((args: Arguments) => {
        container
          .register<IntegrationOptions>(IntegrationOptions, {
            useValue: {
              // TODO: (victor.polyakov@brightsec.com) Write correct type checking
              timeout: +(args.timeout as number),
              apiKey: args.password as string,
              user: args.user as string,
              baseUrl: args.baseUrl as string,
              insecure: args.insecure as boolean
            }
          })
          .register<RabbitMQBusOptions>(RabbitMQBusOptions, {
            useValue: {
              exchange: 'EventBus',
              clientQueue: `integration:${args.accessKey}`,
              connectTimeout: 10000,
              url: args.bus as string,
              proxyUrl: (args.proxyExternal ?? args.proxy) as string,
              credentials: {
                username: 'bot',
                password: args.token as string
              }
            }
          });
      });
  }

  public async handler(args: Arguments): Promise<void> {
    const bus: Bus = container.resolve(Bus);
    const startupManager: StartupManager = container.resolve(StartupManager);
    const pingTracers: IntegrationPingTracer[] =
      container.resolveAll(IntegrationClient);
    const pingTracer = pingTracers.find((p) => p.type === args.type);

    if (!pingTracer) {
      logger.error(`Unsupported integration: ${args.type}`);
      process.exit(1);
    }

    const dispose: () => Promise<void> = async (): Promise<void> => {
      clearInterval(timer);
      await notify(ConnectivityStatus.DISCONNECTED);
      await bus.destroy();
    };

    if (args.remove) {
      await startupManager.uninstall(Integration.SERVICE_NAME);
      logger.log(
        'The Repeater daemon process (SERVICE: %s) was stopped and deleted successfully',
        Integration.SERVICE_NAME
      );
      process.exit(0);
    }

    if (args.daemon) {
      const { command, args: execArgs } = Helpers.getExecArgs({
        escape: false,
        include: ['--run'],
        exclude: ['--daemon', '-d']
      });

      await startupManager.install({
        command,
        args: execArgs,
        name: Integration.SERVICE_NAME,
        displayName: 'Bright Integration'
      });

      logger.log(
        'A Integration daemon process was initiated successfully (SERVICE: %s)',
        Integration.SERVICE_NAME
      );

      process.exit(0);
    }

    const onError = (e: Error) => {
      clearInterval(timer);
      logger.error(`Error during "integration": ${e.message}`);
      process.exit(1);
    };

    const stop: () => Promise<void> = async (): Promise<void> => {
      await dispose();
      process.exit(0);
    };

    process.on('SIGTERM', stop).on('SIGINT', stop).on('SIGHUP', stop);

    if (args.run) {
      await startupManager.run(() => stop());
    }

    const notify = (connectivity: ConnectivityStatus) =>
      bus?.publish(
        new IntegrationConnected(args.accessKey as string, connectivity)
      );

    const updateConnectivity = async (): Promise<void> =>
      notify(await pingTracer.ping());

    try {
      await bus.init();

      await bus.subscribe(RegisterIssueHandler);
      await bus.subscribe(RequestProjectsHandler);
      await bus.subscribe(NetworkTestHandler);

      timer = setInterval(() => updateConnectivity(), 10000);

      await updateConnectivity();
    } catch (e) {
      await notify(ConnectivityStatus.DISCONNECTED);
      onError(e);
    }
  }
}

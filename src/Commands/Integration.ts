import { container } from '../Config';
import { Bus, RabbitMQBusOptions } from '../Bus';
import { IntegrationConnected } from '../Handlers';
import { ConnectivityStatus, IntegrationClient, JiraApiOptions } from '../Integrations';
import { Helpers, logger } from '../Utils';
import { StartupManagerFactory } from '../StartupScripts';
import { RegisterIssueHandler } from '../Handlers/RegisterIssueHandler';
import { GetProjectsHandler } from '../Handlers/GetProjectsHandler';
import { Arguments, Argv, CommandModule } from 'yargs';
import Timer = NodeJS.Timer;

let timer: Timer;

export class Integration implements CommandModule {
  private static SERVICE_NAME = 'nexploit-integration';
  public readonly command = 'integration [options]';
  public readonly describe = 'Starts an on-prem integration.';

  public builder(argv: Argv): Argv {
    return argv
      .option('bus', {
        default: 'amqps://amq.nexploit.app:5672',
        demandOption: true,
        describe: 'NexPloit Event Bus'
      })
      .option('token', {
        alias: 't',
        describe: 'NexPloit API-key',
        requiresArg: true,
        demandOption: true
      })
      .option('type', {
        choices: ['jira'],
        requiresArg: true,
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
      .option('user', {
        alias: 'u',
        describe: 'Use username for Jira Server or email for Jira on Atlassian cloud.',
        requiresArg: true,
        demandOption: true
      })
      .option('password', {
        alias: 'p',
        describe: 'Use password for Jira Server or API token for Jira on Atlassian cloud.',
        requiresArg: true,
        demandOption: true
      })
      .option('daemon', {
        requiresArg: false,
        alias: 'd',
        describe: 'Run integration in daemon mode'
      })
      .middleware((args: Arguments) => {
        container
          .register(JiraApiOptions, {
            useValue: {
              baseUrl: args.baseUrl,
              user: args.user,
              apiKey: args.password,
            }
          })
          .register(RabbitMQBusOptions, {
            useValue: {
              exchange: 'EventBus',
              clientQueue: `integration:${args.accessKey}`,
              connectTimeout: 10000,
              url: args.bus as string,
              proxyUrl: args.proxy as string,
              credentials: {
                username: args.accessKey as string,
                password: args.token as string
              },
              onError(e: Error) {
                clearInterval(timer);
                logger.error(`Error during "integration": ${e.message}`);
                process.exit(1);
              }
            }
          });
      });
  }

  public async handler(args: Arguments): Promise<void> {
    const bus: Bus = container.resolve(Bus);
    const startupManagerFactory: StartupManagerFactory = container.resolve(
      StartupManagerFactory
    );
    const integrationClient: IntegrationClient = container.resolve(IntegrationClient);

    const dispose: () => Promise<void> = async (): Promise<void> => {
      clearInterval(timer);
      await notify(ConnectivityStatus.DISCONNECTED);
      await bus.destroy();
    };

    if (args.daemon) {
      const { command, args: execArgs } = Helpers.getExecArgs({
        exclude: ['--daemon', '-d'],
        include: ['--run']
      });

      const startupManager = startupManagerFactory.create({ dispose });
      await startupManager.install({
        command,
        args: execArgs,
        name: Integration.SERVICE_NAME,
        displayName: 'NexPloit Integration'
      });

      logger.log(
        'A Integration daemon process was initiated successfully (SERVICE: %s)',
        Integration.SERVICE_NAME
      );

      process.exit(0);

      return;
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

    const notify = (connectivity: ConnectivityStatus) => bus?.publish(new IntegrationConnected(args.accessKey as string, connectivity));

    const updateConnectivity = async (): Promise<void> => notify(await integrationClient.ping());

    try {
      await bus.init();

      await bus.subscribe(RegisterIssueHandler);
      await bus.subscribe(GetProjectsHandler);

      timer = setInterval(() => updateConnectivity(), 10000);

      await updateConnectivity();
    } catch (e) {
      await notify(ConnectivityStatus.DISCONNECTED);
      onError(e);
    }
  }
}
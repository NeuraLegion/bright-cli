import { Bus, RabbitMQBusOptions } from '../Bus';
import { ScriptLoader } from '../Scripts';
import {
  LatestVersionPublishedHandler,
  NetworkTestHandler,
  RegisterScriptsHandler,
  RepeaterStatusUpdated,
  SendRequestHandler
} from '../Handlers';
import { Cert, Certificates, RequestExecutorOptions } from '../RequestExecutor';
import { Helpers, logger } from '../Utils';
import { StartupManagerFactory } from '../StartupScripts';
import { container } from '../Config';
import { CliInfo } from '../Config';
import { Arguments, Argv, CommandModule } from 'yargs';
import { normalize } from 'path';
import Timer = NodeJS.Timer;

let timer: Timer;

export class RunRepeater implements CommandModule {
  private static SERVICE_NAME = 'nexploit-repeater';
  public readonly command = 'repeater [options]';
  public readonly describe = 'Starts an on-prem agent.';

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
      .option('id', {
        alias: 'agent',
        describe:
          'ID of an existing repeater which you want to use to run a new scan.',
        type: 'string',
        requiresArg: true,
        demandOption: true
      })
      .option('scripts', {
        alias: 'S',
        requiresArg: true,
        string: true,
        describe:
          'JSON string which contains script list, which is initially empty and consists of zero or more host and path pairs. Example: {"*.example.com": "./hmac.js"}',
        coerce(arg: string): Record<string, string> {
          return JSON.parse(arg);
        }
      })
      .option('timeout', {
        number: true,
        requiresArg: true,
        default: 30000,
        describe:
          'Time to wait for a server to send response headers (and start the response body) before aborting the request.'
      })
      .option('header', {
        alias: 'H',
        requiresArg: true,
        conflicts: ['headers'],
        array: true,
        describe:
          'A list of specific headers that should be included into request.',
        coerce(arg: string[]): Record<string, string> {
          return Array.isArray(arg) ? Helpers.parseHeaders(arg) : {};
        }
      })
      .option('headers', {
        requiresArg: true,
        string: true,
        conflicts: ['header'],
        describe:
          'JSON string which contains header list, which is initially empty and consists of zero or more name and value pairs. Example: {"x-slack-signature": "Z2dFIHJldHNhRQ"}',
        coerce(arg: string): Record<string, string> {
          return JSON.parse(arg);
        }
      })
      .option('cacert', {
        default: false,
        requiresArg: true,
        describe:
          'The path to file which may contain multiple CA certificates. Example: /etc/ssl/certs/ca-certificates.crt',
        coerce(arg: string): string | boolean {
          return typeof arg === 'string' || typeof arg === 'boolean'
            ? arg
            : false;
        }
      })
      .option('cert', {
        requiresArg: true,
        array: true,
        string: true,
        describe:
          'The certificate must be in PKCS, or PEM format. Example: {"hostname": "example.com", "path": "./example.pem", "passphrase": "pa$$word"}.',
        coerce(args: string[]): Cert[] {
          return args
            .map((arg: string) => JSON.parse(arg))
            .map(({ path, hostname, passphrase }: Cert) => {
              if (!path) {
                logger.error(
                  'Error during "repeater": Specify the path to your client certificate file.'
                );
                process.exit(1);

                return;
              }

              if (!hostname) {
                logger.error(
                  'Error during "repeater": Specify the hostname (without protocol and port) of the request URL for which you want to use the certificate.'
                );
                process.exit(1);

                return;
              }

              return {
                hostname,
                passphrase,
                path: normalize(path)
              };
            });
        }
      })
      .option('daemon', {
        requiresArg: false,
        alias: 'd',
        describe: 'Run as repeater in daemon mode'
      })
      .option('run', {
        requiresArg: false,
        hidden: true
      })
      .option('remove-daemon', {
        requiresArg: false,
        alias: ['rm', 'remove'],
        describe: 'Stop and remove repeater daemon'
      })
      .conflicts('remove-daemon', 'daemon')
      .env('REPEATER')
      .exitProcess(false)
      .middleware((args: Arguments) =>
        container
          .register(RequestExecutorOptions, {
            useValue: {
              headers: (args.header ?? args.headers) as Record<string, string>,
              timeout: args.timeout as number,
              proxyUrl: args.proxy as string,
              certs: args.cert as Cert[],
              maxContentLength: 100,
              whitelistMimes: [
                'text/html',
                'text/plain',
                'text/css',
                'text/javascript',
                'text/markdown',
                'text/xml',
                'application/javascript',
                'application/json',
                'application/xml',
                'application/x-www-form-urlencoded',
                'application/msgpack',
                'application/ld+json',
                'application/graphql'
              ]
            } as RequestExecutorOptions
          })
          .register(RabbitMQBusOptions, {
            useValue: {
              exchange: 'EventBus',
              clientQueue: `agent:${args.id as string}`,
              connectTimeout: 10000,
              url: args.bus as string,
              proxyUrl: args.proxy as string,
              credentials: {
                username: 'bot',
                password: args.token as string
              },
              onError(e: Error) {
                clearInterval(timer);
                logger.error(`Error during "repeater": ${e.message}`);
                process.exit(1);
              }
            }
          })
      );
  }

  public async handler(args: Arguments): Promise<void> {
    const bus: Bus = container.resolve(Bus);
    const info = container.resolve(CliInfo);

    const startupManagerFactory: StartupManagerFactory = container.resolve(
      StartupManagerFactory
    );

    if (args.cacert) {
      const certificates: Certificates = container.resolve(Certificates);
      await certificates.load(
        typeof args.cacert === 'string' ? args.cacert : undefined
      );
    }

    const dispose: () => Promise<void> = async (): Promise<void> => {
      clearInterval(timer);
      await notify('disconnected');
      await bus.destroy();
    };

    const removeAction = async () => {
      const startupManager = startupManagerFactory.create({ dispose });
      await startupManager.uninstall(RunRepeater.SERVICE_NAME);
      logger.log(
        'The Repeater daemon process (SERVICE: %s) was stopped and deleted successfully',
        RunRepeater.SERVICE_NAME
      );
    };

    if (args.remove) {
      await removeAction();

      return;
    }

    if (args.daemon) {
      const { command, args: execArgs } = Helpers.getExecArgs({
        exclude: ['--daemon', '-d'],
        include: ['--run']
      });

      const startupManager = startupManagerFactory.create({ dispose });
      await startupManager.install({
        command,
        args: execArgs,
        name: RunRepeater.SERVICE_NAME,
        displayName: 'NexPloit Repeater'
      });

      logger.log(
        'A Repeater daemon process was initiated successfully (SERVICE: %s)',
        RunRepeater.SERVICE_NAME
      );

      process.exit(0);

      return;
    }

    if (args.run) {
      const startupManager = startupManagerFactory.create({ dispose });
      await startupManager.run();
    }

    const onError = (e: Error) => {
      clearInterval(timer);
      logger.error(`Error during "repeater": ${e.message}`);
      process.exit(1);
    };

    const stop: () => Promise<void> = async (): Promise<void> => {
      await dispose();
      process.exit(0);
    };

    process.on('SIGTERM', stop).on('SIGINT', stop).on('SIGHUP', stop);

    const notify = (status: 'connected' | 'disconnected') =>
      bus?.publish(
        new RepeaterStatusUpdated(args.id as string, status, info.version)
      );

    try {
      logger.log('Starting the Repeater (%s)...', info.version);

      if (args.scripts) {
        const loader: ScriptLoader = container.resolve(ScriptLoader);

        await loader.load(args.scripts as Record<string, string>);
      }

      await bus.init();

      await bus.subscribe(LatestVersionPublishedHandler);
      await bus.subscribe(RegisterScriptsHandler);
      await bus.subscribe(NetworkTestHandler);
      await bus.subscribe(SendRequestHandler);

      timer = setInterval(() => notify('connected'), 10000);

      await notify('connected');

      logger.log(`The Repeater (%s) started`, info.version);
    } catch (e) {
      await notify('disconnected');
      onError(e);
    }
  }
}

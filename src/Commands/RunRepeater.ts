import { RabbitMQBusOptions } from '../Bus';
import { Cert, RequestExecutorOptions } from '../RequestExecutor';
import { Helpers, logger } from '../Utils';
import { container } from '../Config';
import { RepeaterLauncher } from '../Repeater';
import { Arguments, Argv, CommandModule } from 'yargs';
import { normalize } from 'path';

export class RunRepeater implements CommandModule {
  public readonly command = 'repeater [options]';
  public readonly describe = 'Starts an on-prem agent.';

  public builder(argv: Argv): Argv {
    return argv
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
      .middleware((args: Arguments) => {
        const id = args.id as string;
        if (!Helpers.isShortUUID(id) && !Helpers.isUUID(id)) {
          throw new Error(
            'Option --id has wrong value. Please ensure that --id option has a valid ID.'
          );
        }
      })
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
              }
            }
          })
      );
  }

  // eslint-disable-next-line complexity
  public async handler(args: Arguments): Promise<void> {
    const repeaterLauncher: RepeaterLauncher = container.resolve(
      RepeaterLauncher
    );

    if (args.cacert) {
      await repeaterLauncher.loadCerts(
        typeof args.cacert === 'string' ? args.cacert : undefined
      );
    }

    if (args.scripts) {
      await repeaterLauncher.loadScripts(
        args.scripts as Record<string, string>
      );
    }

    if (args.remove) {
      await repeaterLauncher.uninstall();
      process.exit(0);

      return;
    }

    if (args.daemon) {
      await repeaterLauncher.install();
      process.exit(0);

      return;
    }

    try {
      ['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((event) =>
        process.on(event, async () => {
          await repeaterLauncher.close();
          process.exit(0);
        })
      );

      await repeaterLauncher.run(args.id as string, args.run as boolean);
    } catch (e) {
      logger.error(e.message);
      await repeaterLauncher.close();
      process.exit(1);
    }
  }
}

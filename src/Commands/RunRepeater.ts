import { Cert, RequestExecutorOptions } from '../RequestExecutor';
import { Helpers, logger } from '../Utils';
import { container } from '../Config';
import { RabbitMQBusOptions } from '../Bus';
import {
  DefaultRepeaterLauncher,
  DefaultRepeaterServerOptions,
  RepeaterLauncher,
  ServerRepeaterLauncher
} from '../Repeater';
import { Arguments, Argv, CommandModule } from 'yargs';
import { Lifecycle } from 'tsyringe';
import { normalize } from 'path';

export class RunRepeater implements CommandModule {
  public readonly command = 'repeater [options]';
  public readonly describe = 'Starts an on-prem agent.';

  public builder(argv: Argv): Argv {
    return argv
      .option('token', {
        alias: 't',
        describe: 'Bright API-key',
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
              }

              if (!hostname) {
                logger.error(
                  'Error during "repeater": Specify the hostname (without protocol and port) of the request URL for which you want to use the certificate.'
                );
                process.exit(1);
              }

              return {
                hostname,
                passphrase,
                path: normalize(path)
              };
            });
        }
      })
      .option('experimental-connection-reuse', {
        boolean: true,
        describe: 'Configure experimental support for TCP connections reuse'
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
      .option('rabbitmq', {
        boolean: true,
        describe:
          'Enable legacy mode, utilizing the RabbitMQ connection for communication.'
      })
      .conflicts('remove-daemon', 'daemon')
      .conflicts('experimental-connection-reuse', 'proxy')
      .conflicts('experimental-connection-reuse', 'proxy-external')
      .conflicts('experimental-connection-reuse', 'proxy-internal')
      .conflicts('proxy-external', 'proxy')
      .conflicts('proxy-internal', 'proxy')
      .env('REPEATER')
      .middleware((args: Arguments) => {
        if (Object.hasOwnProperty.call(args, '')) {
          // handling the case of having REPEATER environment variable w/o suffix,
          // that results in yargs option with empty name
          delete args[''];
        }
      }, true)
      .exitProcess(false)
      .check((args: Arguments) => {
        const id = args.id as string;
        if (!Helpers.isShortUUID(id) && !Helpers.isUUID(id)) {
          throw new Error(
            'Option --id has wrong value. Please ensure that --id option has a valid ID.'
          );
        }

        return true;
      })
      .middleware((args: Arguments) => {
        container
          .register<RequestExecutorOptions>(RequestExecutorOptions, {
            useValue: {
              headers: (args.header ?? args.headers) as Record<string, string>,
              timeout: args.timeout as number,
              proxyUrl: (args.proxyInternal ?? args.proxy) as string,
              certs: args.cert as Cert[],
              maxContentLength: 100,
              reuseConnection: !!args.experimentalConnectionReuse,
              whitelistMimes: [
                'text/html',
                'text/plain',
                'text/css',
                'text/javascript',
                'text/markdown',
                'text/xml',
                'application/javascript',
                'application/x-javascript',
                'application/json',
                'application/xml',
                'application/x-www-form-urlencoded',
                'application/msgpack',
                'application/ld+json',
                'application/graphql'
              ]
            }
          })
          .register<RabbitMQBusOptions>(RabbitMQBusOptions, {
            useValue: {
              exchange: 'EventBus',
              clientQueue: `agent:${args.id as string}`,
              connectTimeout: 10000,
              url: args.bus as string,
              proxyUrl: (args.proxyExternal ?? args.proxy) as string,
              credentials: {
                username: 'bot',
                password: args.token as string
              }
            }
          })
          .register<DefaultRepeaterServerOptions>(
            DefaultRepeaterServerOptions,
            {
              useValue: {
                uri: args.repeaterServer as string,
                token: args.token as string,
                connectTimeout: 10000,
                proxyUrl: (args.proxyExternal ?? args.proxy) as string
              }
            }
          )
          .register<RepeaterLauncher>(
            RepeaterLauncher,
            {
              useClass: args.rabbitmq
                ? DefaultRepeaterLauncher
                : ServerRepeaterLauncher
            },
            { lifecycle: Lifecycle.Singleton }
          );
      });
  }

  // eslint-disable-next-line complexity
  public async handler(args: Arguments): Promise<void> {
    const repeaterLauncher: RepeaterLauncher =
      container.resolve(RepeaterLauncher);

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
    }

    if (args.daemon) {
      await repeaterLauncher.install();
      process.exit(0);
    }

    try {
      ['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((event) =>
        process.on(event, async () => {
          await repeaterLauncher.close();
          process.exitCode = 0;
        })
      );

      await repeaterLauncher.run(args.id as string, args.run as boolean);
    } catch (e) {
      logger.error(e);
      await repeaterLauncher.close();
      process.exitCode = 1;
    }
  }
}

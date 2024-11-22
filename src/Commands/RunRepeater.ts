import { Cert, RequestExecutorOptions } from '../RequestExecutor';
import { ErrorMessageFactory, Helpers, logger } from '../Utils';
import container from '../container';
import { DefaultRepeaterServerOptions, RepeaterLauncher } from '../Repeater';
import { Arguments, Argv, CommandModule } from 'yargs';
import { captureException } from '@sentry/node';
import { normalize } from 'node:path';

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
        deprecated: 'Use --header instead.',
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
        deprecated: 'Use --ntlm instead',
        boolean: true,
        describe: 'Configure ntlm support (enables TCP connection reuse)'
      })
      .option('ntlm', {
        boolean: true,
        describe: 'Configure ntlm support (enables TCP connection reuse)'
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
      .option('proxy-domains', {
        requiresArg: true,
        array: true,
        describe:
          'Space-separated list of domains that should be routed through the proxy. This option is only applicable when using the --proxy option'
      })
      .option('proxy-domains-bypass', {
        requiresArg: true,
        array: true,
        describe:
          'Space-separated list of domains that should not be routed through the proxy. This option is only applicable when using the --proxy option'
      })
      .conflicts({
        daemon: 'remove-daemon',
        ntlm: ['proxy', 'experimental-connection-reuse']
      })
      .conflicts('proxy-domains', 'proxy-domains-bypass')
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
              proxyUrl: (args.proxyTarget ?? args.proxy) as string,
              certs: args.cert as Cert[],
              maxBodySize: Infinity,
              maxContentLength: 100,
              reuseConnection:
                !!args.ntlm || !!args.experimentalConnectionReuse,
              whitelistMimes: [
                { type: 'text/html', allowTruncation: false },
                { type: 'text/plain', allowTruncation: true },
                { type: 'text/css', allowTruncation: false },
                { type: 'text/javascript', allowTruncation: false },
                { type: 'text/markdown', allowTruncation: true },
                { type: 'text/xml', allowTruncation: false },
                { type: 'application/javascript', allowTruncation: false },
                { type: 'application/x-javascript', allowTruncation: false },
                { type: 'application/json', allowTruncation: false },
                { type: 'application/xml', allowTruncation: false },
                {
                  type: 'application/x-www-form-urlencoded',
                  allowTruncation: false
                },
                { type: 'application/msgpack', allowTruncation: false },
                { type: 'application/ld+json', allowTruncation: false },
                { type: 'application/graphql', allowTruncation: false }
              ],
              proxyDomains: args.proxyDomains as string[],
              proxyDomainsBypass: args.proxyDomainsBypass as string[]
            }
          })
          .register<DefaultRepeaterServerOptions>(
            DefaultRepeaterServerOptions,
            {
              useValue: {
                uri: args.repeaterServer as string,
                token: args.token as string,
                connectTimeout: args.timeout as number,
                proxyUrl: (args.proxyBright ?? args.proxy) as string,
                insecure: args.insecure as boolean
              }
            }
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
      process.exitCode = 0;

      return;
    }

    if (args.daemon) {
      await repeaterLauncher.install();
      process.exitCode = 0;

      return;
    }

    try {
      ['SIGTERM', 'SIGINT', 'SIGHUP'].forEach((event) =>
        process.on(event, async () => {
          await repeaterLauncher.close();
          process.exitCode = 0;
        })
      );

      await repeaterLauncher.run(args.id as string, args.run as boolean);
    } catch (error) {
      captureException(error);
      logger.error(
        ErrorMessageFactory.genericCommandError({ error, command: 'repeater' })
      );
      await repeaterLauncher.close();
      process.exitCode = 1;
    }
  }
}

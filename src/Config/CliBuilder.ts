import { CliConfig, ConfigReader } from './ConfigReader';
import { ClusterArgs, Helpers, logger, LogLevel } from '../Utils';
import { SystemConfigManager } from './SystemConfigManager';
import { CliInfo } from './CliInfo';
import { Arguments, Argv, CommandModule } from 'yargs';
import { init, runWithAsyncContext, setContext } from '@sentry/node';

export interface CliBuilderOptions {
  info: CliInfo;
  configReader: ConfigReader;
}

export class CliBuilder {
  private _options: CliBuilderOptions;

  get options(): CliBuilderOptions {
    return this._options;
  }

  constructor(options: CliBuilderOptions) {
    this._options = options;
  }

  public build({ commands }: { commands: CommandModule[] }): Argv {
    const { configReader, info } = this.options;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cli: Argv = require('yargs')
      .option('config', {
        requiresArg: true,
        describe: 'Path to the file with configuration',
        config: true,
        default: configReader.discovery(info.cwd),
        configParser: (configPath: string): CliConfig =>
          configReader.load(configPath).toJSON()
      })
      .option('log-level', {
        requiresArg: true,
        choices: Object.keys(LogLevel).map((x) =>
          !isNaN(+x) ? +x : x.toLowerCase()
        ),
        default: LogLevel.NOTICE,
        describe:
          'What level of logs to report. Any logs of a higher level than the setting are shown.'
      })
      .option('cluster', {
        deprecated: 'Use --hostname instead',
        requiresArg: true,
        describe:
          'Bright application name (domain name). [default: app.brightsec.com]'
      })
      .option('hostname', {
        requiresArg: true,
        describe:
          'Bright application name (domain name). [default: app.brightsec.com]'
      })
      .option('insecure', {
        boolean: true,
        default: false,
        description:
          'Allows CLI to proceed and operate even for server connections otherwise considered insecure.'
      })
      .option('proxy', {
        requiresArg: true,
        describe:
          'Specify a proxy URL to route all traffic through. This should be an HTTP(S), SOCKS4, or SOCKS5 URL. By default, if you specify SOCKS://<URL>, then SOCKS5h is applied.'
      })
      .option('proxy-bright', {
        requiresArg: true,
        describe:
          'Specify a proxy URL to route all outbound traffic through. For more information, see the --proxy option.'
      })
      .option('proxy-target', {
        requiresArg: true,
        describe:
          'Specify a proxy URL to route all inbound traffic through. For more information, see the --proxy option.'
      })
      .option('timeout', {
        describe: 'Request timeout in seconds',
        default: 30,
        type: 'number',
        coerce(arg: number) {
          return arg * 1000;
        }
      })
      .conflicts({
        proxy: ['proxy-bright', 'proxy-target'],
        hostname: 'cluster'
      })
      .middleware((args: Arguments) => {
        ({ api: args.api, repeaterServer: args.repeaterServer } =
          Helpers.getClusterUrls(args as ClusterArgs));
      })
      // TODO: (victor.polyakov@brightsec.com) Write correct type checking
      .middleware(
        (args: Arguments) =>
          (logger.logLevel = !isNaN(+args.logLevel)
            ? (+args.logLevel as unknown as LogLevel)
            : LogLevel[args.logLevel.toString().toUpperCase()])
      )
      .usage('Usage: $0 <command> [options] [<file | scan>]')
      .pkgConf('bright', info.cwd)
      .example(
        '$0 archive:generate --mockfile=.mockfile --name=archive.har',
        'output har file on base your mock requests'
      );

    return commands
      .reduce(
        (acc: Argv, item: CommandModule) =>
          acc.command(this.wrapWithSentry(item)),
        cli
      )
      .recommendCommands()
      .demandCommand(1)
      .strict(true)
      .version(info.version)
      .alias('v', 'version')
      .help('help')
      .alias('h', 'help')
      .wrap(null);
  }

  private wrapWithSentry(command: CommandModule) {
    const handler = command.handler.bind(command);

    command.handler = async (args: Arguments) => {
      const systemConfigManager = new SystemConfigManager(args.api as string);
      const systemConfig = await systemConfigManager.read();

      return runWithAsyncContext(() => {
        this.initSentry(systemConfig.sentryDsn);
        setContext('args', args);

        systemConfigManager.enableBackgroundRotation((rotatedSystemConfig) => {
          this.initSentry(rotatedSystemConfig.sentryDsn);
        });

        return handler(args);
      });
    };

    return command;
  }

  private initSentry(dsn: string) {
    init({
      dsn,
      attachStacktrace: true,
      release: process.env.VERSION,
      beforeSend(event) {
        if (event.contexts.args) {
          event.contexts.args = {
            ...event.contexts.args,
            t: event.contexts.args.t && '[Filtered]',
            token: event.contexts.args.token && '[Filtered]'
          };
        }

        return event;
      }
    });
  }
}

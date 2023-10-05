import { CliConfig, ConfigReader } from './ConfigReader';
import { ClusterArgs, Helpers, logger, LogLevel, Sentry } from '../Utils';
import { SystemConfigReader } from './SystemConfigReader';
import { CliInfo } from './CliInfo';
import { Arguments, Argv, CommandModule } from 'yargs';

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
        describe: 'SOCKS4 or SOCKS5 URL to proxy all traffic'
      })
      .option('proxy-external', {
        requiresArg: true,
        describe: 'SOCKS4 or SOCKS5 URL to proxy external traffic'
      })
      .option('proxy-internal', {
        requiresArg: true,
        describe: 'SOCKS4 or SOCKS5 URL to proxy internal traffic'
      })
      .middleware((args: Arguments) => {
        ({
          bus: args.bus,
          api: args.api,
          repeaterServer: args.repeaterServer
        } = Helpers.getClusterUrls(args as ClusterArgs));
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
      .reduce((acc: Argv, item: CommandModule) => {
        const handler = item.handler.bind(item);

        item.handler = async (args: Arguments) => {
          const systemConfigReader = new SystemConfigReader(args.api as string);
          const systemConfig = await systemConfigReader.read();

          Sentry.init({
            attachStacktrace: true,
            dsn: systemConfig.sentryDsn,
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

          return Sentry.runWithAsyncContext(() => {
            Sentry.setContext('args', args);

            return handler(args);
          });
        };

        acc.command(item);

        return acc;
      }, cli)
      .recommendCommands()
      .demandCommand(1)
      .strict(true)
      .version(info.version)
      .alias('v', 'version')
      .help('help')
      .alias('h', 'help')
      .wrap(null);
  }
}

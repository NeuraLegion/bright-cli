import { CliConfig, ConfigReader } from './ConfigReader';
import { ClusterArgs, Helpers, logger, LogLevel } from '../Utils';
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
      .option('api', {
        requiresArg: true,
        demandOption: true,
        deprecated: true,
        describe:
          'Bright application base URL. [default: https://app.brightsec.com]'
      })
      .option('bus', {
        requiresArg: true,
        demandOption: true,
        deprecated: true,
        describe:
          'Bright Event Bus base URL. [default: amqps://amq.app.brightsec.com:5672]'
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
        ({ bus: args.bus, api: args.api } = Helpers.getClusterUrls(
          args as ClusterArgs
        ));
      }, true)
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
      .reduce((acc: Argv, item: CommandModule) => acc.command(item), cli)
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

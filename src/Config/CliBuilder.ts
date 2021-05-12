import { CliConfig } from './ConfigReader';
import { DefaultConfigReader } from './DefaultConfigReader';
import { logger, LogLevel } from '../Utils';
import { sync } from 'find-up';
import { Arguments, Argv, CommandModule } from 'yargs';
import path from 'path';

export class CliBuilder {
  private _cwd: string;

  get cwd(): string {
    return this._cwd;
  }

  constructor({ cwd = process.cwd() }: { cwd: string }) {
    this._cwd = this.guessCWD(cwd);
  }

  public build({
    commands,
    configReader
  }: {
    commands: CommandModule[];
    configReader: DefaultConfigReader;
  }): Argv {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cli: Argv = require('yargs')
      .option('config', {
        requiresArg: true,
        describe: 'Path to the file with configuration',
        config: true,
        default: configReader.discovery(this.cwd),
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
        default: 'https://nexploit.app/',
        requiresArg: true,
        demandOption: true,
        describe: 'NexPloit base URL'
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
      .middleware(
        (args: Arguments) =>
          (logger.logLevel = !isNaN(+args.logLevel)
            ? ((+args.logLevel as unknown) as LogLevel)
            : LogLevel[args.logLevel.toString().toUpperCase()])
      )
      .usage('Usage: $0 <command> [options] [<file | scan>]')
      .pkgConf('nexploit', this._cwd)
      .example(
        '$0 archive:generate --mockfile=.mockfile --name=archive.har',
        'output har file on base your mock requests'
      );

    return commands
      .reduce((acc: Argv, item: CommandModule) => acc.command(item), cli)
      .recommendCommands()
      .demandCommand(1)
      .strict(true)
      .alias('v', 'version')
      .help('help')
      .alias('h', 'help')
      .wrap(null);
  }

  private guessCWD(cwd: string): string {
    cwd = cwd || process.env.NEXPLOIT_CWD || process.cwd();

    const pkgPath: string | null = sync('package.json', { cwd });

    if (pkgPath) {
      cwd = path.dirname(pkgPath);
    }

    return cwd;
  }
}

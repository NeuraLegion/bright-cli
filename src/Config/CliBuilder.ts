import { CliConfig } from './ConfigReader';
import { DefaultConfigReader } from './DefaultConfigReader';
import { sync } from 'find-up';
import { Argv, CommandModule } from 'yargs';
import path from 'path';

export class CliBuilder {
  private _cwd: string;

  get cwd(): string {
    return this._cwd;
  }

  constructor({
    cwd = process.cwd(),
    colors = false
  }: {
    cwd: string;
    colors: boolean;
  }) {
    this._cwd = this.guessCWD(cwd);
    if (colors) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('yargonaut')
        .style('blue')
        .style('yellow', 'required')
        .helpStyle('green')
        .errorsStyle('red');
    }
  }

  public build({
    commands,
    configReader
  }: {
    commands: CommandModule[];
    configReader: DefaultConfigReader;
  }): Argv {
    const config: CliConfig = configReader.load(this.cwd).toJSON();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cli: Argv = require('yargs')
      .usage('Usage: $0 <command> [options] [<file | scan>]')
      .pkgConf('nexploit', this._cwd)
      .example(
        '$0 archive:generate --mockfile=.mockfile --name=archive.har',
        'output har file on base your mock requests'
      )
      .config(config);

    return commands
      .reduce((acc: Argv, item: CommandModule) => acc.command(item), cli)
      .recommendCommands()
      .demandCommand(1)
      .strict(false)
      .alias('v', 'version')
      .help('help')
      .alias('h', 'help');
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

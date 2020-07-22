import { sync } from 'find-up';
import { Argv, CommandModule } from 'yargs';
import fs from 'fs';
import path from 'path';

export class CliBuilder {
  private readonly cwd: string;
  private readonly config: Map<string, any>;
  private readonly rcOptions: string[] = [
    '.nexploitrc',
    '.nexploitrc.json',
    '.nexploitrc.yml',
    '.nexploitrc.yaml',
    'nexploit.config.js'
  ];

  constructor({
    cwd = process.cwd(),
    colors = false
  }: {
    cwd: string;
    colors: boolean;
  }) {
    this.config = new Map<string, any>();
    this.cwd = this.guessCWD(cwd);
    if (colors) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('yargonaut')
        .style('blue')
        .style('yellow', 'required')
        .helpStyle('green')
        .errorsStyle('red');
    }
    this.load();
  }

  public build(...commands: CommandModule[]): Argv {
    const config: any = this.configToJson();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cli: Argv = require('yargs')
      .usage('Usage: $0 <command> [options] [<file | scan>]')
      .pkgConf('nexploit', this.cwd)
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

  private load(): this {
    const rcPath: string | null = sync(this.rcOptions, {
      cwd: this.cwd
    });

    if (!rcPath) {
      return;
    }

    const rcExt: string = path.extname(rcPath.toLowerCase());

    if (rcExt === '.js') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.configure(require(rcPath));
    } else if (rcExt === '.yml' || rcExt === '.yaml') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.configure(require('js-yaml').load(fs.readFileSync(rcPath, 'utf8')));
    } else {
      this.configure(JSON.parse(fs.readFileSync(rcPath, 'utf-8')));
    }

    return this;
  }

  private guessCWD(cwd: string): string {
    cwd = cwd || process.env.NEXPLOIT_CWD || process.cwd();

    const pkgPath: string | null = sync('package.json', { cwd });

    if (pkgPath) {
      cwd = path.dirname(pkgPath);
    }

    return cwd;
  }

  private configToJson(): any {
    return [...this.config.entries()].reduce(
      (acc: any, [key, value]: [string, any]) => {
        acc[key] = value;

        return acc;
      },
      {}
    );
  }

  private configure(map: { [key: string]: any }): void {
    Object.entries(map).map(([key, value]: [string, any]) =>
      this.config.set(key, value)
    );
  }
}

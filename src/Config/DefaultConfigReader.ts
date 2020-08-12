import { CliConfig, ConfigReader } from './ConfigReader';
import { omit } from '../Utils/omit';
import { sync } from 'find-up';
import path from 'path';
import fs from 'fs';

export class DefaultConfigReader implements ConfigReader {
  private readonly rcOptions: string[] = [
    '.nexploitrc',
    '.nexploitrc.json',
    '.nexploitrc.yml',
    '.nexploitrc.yaml',
    'nexploit.config.js'
  ];
  private readonly config: Map<string, any>;

  constructor(private readonly root: string) {
    this.config = new Map<string, any>();
  }

  public load(): this {
    const rcPath: string | null = sync(this.rcOptions, {
      cwd: this.root
    });

    if (!rcPath) {
      return this;
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

  public get<T extends keyof CliConfig>(key: T): CliConfig[T] {
    return this.config.get(key);
  }

  public toJSON(): any {
    return Object.fromEntries(this.config.entries());
  }

  private configure(map: { [key: string]: any }): void {
    Object.entries(omit(map)).map(([key, value]: [string, any]) =>
      this.config.set(key, value)
    );
  }
}

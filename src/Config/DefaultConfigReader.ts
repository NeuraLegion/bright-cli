import { CliConfig, ConfigReader } from './ConfigReader';
import { Helpers } from '../Utils/Helpers';
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
  private readonly config: Map<keyof CliConfig, CliConfig[keyof CliConfig]>;

  constructor() {
    this.config = new Map<keyof CliConfig, CliConfig[keyof CliConfig]>();
  }

  public load(cwd: string): this {
    const rcPath: string | null = sync(this.rcOptions, {
      cwd
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

  public has(key: keyof CliConfig): boolean {
    return this.config.has(key);
  }

  public toJSON(): CliConfig {
    return [...this.config.entries()].reduce(
      (acc: CliConfig, [key, value]: [string, unknown]) => {
        acc[key] = value;

        return acc;
      },
      {} as CliConfig
    );
  }

  private configure(map: { [key: string]: unknown }): void {
    Object.entries(Helpers.omit(map)).map(([key, value]: [string, unknown]) =>
      this.config.set(
        key as keyof CliConfig,
        value as CliConfig[keyof CliConfig]
      )
    );
  }
}

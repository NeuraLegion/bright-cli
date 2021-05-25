export interface CliConfig {
  token?: string;
  api?: string;
  proxy?: string;
  bus?: string;
  id?: string;
}

export interface ConfigReader {
  discovery(cwd: string): string | undefined;

  load(rcPath: string): this;

  get<T extends keyof CliConfig>(key: T): CliConfig[T];

  has(key: keyof CliConfig): boolean;

  toJSON(): CliConfig;
}

export const ConfigReader: unique symbol = Symbol('ConfigReader');

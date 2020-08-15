export interface CliConfig {
  apiKey: string;
  url?: string;
  proxy?: string;
  bus?: string;
  agent?: string;
}

export interface ConfigReader {
  load(cwd: string): this;

  get<T extends keyof CliConfig>(key: T): CliConfig[T];

  has(key: keyof CliConfig): boolean;

  toJSON(): CliConfig;
}

export const ConfigReader: unique symbol = Symbol('ConfigReader');

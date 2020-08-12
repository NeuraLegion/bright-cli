export interface CliConfig {
  apiKey: string;
  url?: string;
  proxy?: string;
}

export interface ConfigReader {
  load(): this;

  get<T extends keyof CliConfig>(key: T): CliConfig[T];

  toJSON(): CliConfig;
}

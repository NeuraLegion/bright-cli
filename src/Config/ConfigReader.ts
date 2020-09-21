export interface CliConfig {
  token?: string;
  api?: string;
  proxy?: string;
  bus?: string;
  id?: string;
}

export interface ConfigReader {
  load(rcPath: string): this;

  get<T extends keyof CliConfig>(key: T): CliConfig[T];

  has(key: keyof CliConfig): boolean;

  toJSON(): CliConfig;
}

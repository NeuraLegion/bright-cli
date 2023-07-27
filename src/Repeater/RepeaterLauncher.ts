export interface RepeaterLauncher {
  loadCerts(cacert?: string): Promise<void>;

  loadScripts(scripts: Record<string, string>): Promise<void>;

  /**
   * @deprecated currently not supported by some implementations
   */
  compileScripts(scripts: string | Record<string, string>): void;

  run(repeaterId: string, asDaemon?: boolean): Promise<void>;

  close(): Promise<void>;

  uninstall(): Promise<void>;

  install(): Promise<void>;
}

export const RepeaterLauncher: unique symbol = Symbol('RepeaterLauncher');

import { StartupOptions } from './StartupOptions';

export interface StartupManager {
  install(opts: StartupOptions): Promise<void>;
  run(dispose?: () => Promise<unknown> | unknown): Promise<void>;
  uninstall(name: string): Promise<void>;
}

export const StartupManager: unique symbol = Symbol('StartupManager');

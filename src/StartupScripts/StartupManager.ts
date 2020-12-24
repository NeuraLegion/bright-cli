import { StartupOptions } from './StartupOptions';

export interface StartupManager {
  install(opts: StartupOptions): Promise<void>;
  run(): Promise<void>;
  stop(code: number): Promise<void>;
  uninstall(name: string): Promise<void>;
}

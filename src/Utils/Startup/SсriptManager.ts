import { StartupOptions } from './StartupOptions';
import { ChildProcess } from 'child_process';

export interface ScriptManager {
  install(opts: StartupOptions): Promise<void>;
  run(opts: StartupOptions): Promise<ChildProcess>;
  uninstall(name: string): Promise<void>;
  getPidIfExists(): Promise<number | undefined>;
}

import { ScriptManager } from '../SсriptManager';
import { StartupOptions } from '../StartupOptions';
import { PidStore } from '../PidStore';
import { RegistryStore } from './RegistryStore';
import { ChildProcess, spawn } from 'child_process';

export class WindowsScriptManager implements ScriptManager {
  private static RUN_LOCATION =
    '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

  private readonly _pidStore;
  private readonly _autoRunStore;

  constructor(pidStore: PidStore) {
    this._pidStore = pidStore;
    this._autoRunStore = new RegistryStore(WindowsScriptManager.RUN_LOCATION);
  }

  public getPidIfExists(): Promise<number | undefined> {
    return this._pidStore.get() || undefined;
  }

  public install(opts: StartupOptions): Promise<void> {
    return this._autoRunStore.set(opts.name, this.getRunString(opts));
  }

  public uninstall(name: string): Promise<void> {
    return this._autoRunStore.set(name, '');
  }

  public async run(opts: StartupOptions): Promise<ChildProcess> {
    const pid = await this._pidStore.get();
    if (pid) {
      try {
        process.kill(pid);
      } catch {
        //nope
      }
    }

    const child = spawn(opts.exePath, opts.args, {
      detached: false,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: process.env,
      cwd: process.cwd()
    });

    await this._pidStore.set(child.pid);
    console.log(`process runs with pid = ${child.pid}`);

    return child;
  }

  private getRunString = (opts: StartupOptions) =>
    `${opts.exePath} ${opts.args}`;
}

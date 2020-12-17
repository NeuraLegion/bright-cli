import { ScriptManager } from '../SсriptManager';
import { StartupOptions } from '../StartupOptions';
import { PidStore } from '../PidStore';
import { RegistryHelper } from './RegistryHelper';
import WinReg from 'winreg';
import { ChildProcess, spawn } from 'child_process';

export class WindowsScriptManager implements ScriptManager {
  private readonly _pidStore;

  constructor(pidStore: PidStore) {
    this._pidStore = pidStore;
  }

  public getPidIfExists(): Promise<number | undefined> {
    return this._pidStore.get() || undefined;
  }

  public install(opts: StartupOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const autoRunKey = RegistryHelper.getRunKey();
      autoRunKey.set(
        opts.name,
        WinReg.REG_SZ,
        this.getRunString(opts),
        (error) => {
          if (error) {
            reject(error);
          }
          resolve();
        }
      );
    });
  }

  public uninstall(name: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const autoRunKey = RegistryHelper.getRunKey();
      autoRunKey.remove(name, (err) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }

  public async run(opts: StartupOptions): Promise<ChildProcess> {
    const pid = await this._pidStore.get();
    if (pid) {
      process.kill(pid);
    }
    const child = spawn(opts.exePath, opts.args, { detached: false });

    await this._pidStore.set(child.pid);
    console.log(`process runs with pid= ${pid}`);

    return child;
  }

  private getRunString = (opts: StartupOptions) =>
    `${opts.exePath} ${opts.args}`;
}

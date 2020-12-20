import { PidStore } from '../PidStore';
import { RegistryStore } from './RegistryStore';

export class RegistryPidStore implements PidStore {
  private static _pidKey = 'pid';
  private static _path = '\\Software\\NEXPLOIT';

  private readonly _store = new RegistryStore(RegistryPidStore._path);

  async get(): Promise<number | undefined> {
    const pid = await this._store.get(RegistryPidStore._pidKey);

    return pid ? parseInt(pid, 10) : undefined;
  }

  set(pid: number): Promise<void> {
    return this._store.set(RegistryPidStore._pidKey, pid.toString());
  }
}

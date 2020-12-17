import { PidStore } from '../PidStore';
import { RegistryHelper } from './RegistryHelper';
import * as WinReg from 'winreg';

export class RegistryPidStore implements PidStore {
  constructor() {
    RegistryHelper.createStore();
  }

  get(): Promise<number | undefined> {
    return new Promise<number | undefined>((resolve, reject) => {
      const key = RegistryHelper.getPidKey();
      key.get('pid', (err, result) => {
        if (err) {
          reject(err);
        }
        const pid = result?.value;
        resolve(pid ? parseInt(pid, 10) : undefined);
      });
    });
  }

  set(pid: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const key = RegistryHelper.getPidKey();
      key.set('pid', WinReg.REG_SZ, pid.toString(), (err) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  }
}

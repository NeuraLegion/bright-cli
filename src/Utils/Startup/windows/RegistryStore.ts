import WinReg, { Registry } from 'winreg';

export class RegistryStore {
  private _path: string;

  constructor(path: string) {
    this._path = path;
  }

  public async get(key: string): Promise<string | undefined> {
    const reg = new WinReg({
      hive: WinReg.HKCU,
      key: this._path
    });

    const isExists = await this.isKeyExists(reg, key);

    if (!isExists) {
      return undefined;
    }

    return new Promise((resolve, reject) => {
      reg.get(key, (err, item) => {
        if (err) {
          return reject(err);
        }
        resolve(item.value);
      });
    });
  }

  public async set(key: string, value: string): Promise<void> {
    const reg = new WinReg({
      hive: WinReg.HKCU,
      key: this._path
    });

    return new Promise((resolve, reject) => {
      reg.set(key, WinReg.REG_SZ, value, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  private isKeyExists(reg: Registry, key: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      reg.valueExists(key, (err: Error, exists: boolean) => {
        if (err) {
          return reject(err);
        }
        resolve(exists);
      });
    });
  }
}

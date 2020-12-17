import WinReg, { Registry } from 'winreg';

const SERVICE_LOCATION = '\\Software\\NEXPLOIT';
const RUN_LOCATION = '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

export class RegistryHelper {
  public static createStore(): void {
    RegistryHelper.initLocation(SERVICE_LOCATION);
    RegistryHelper.initLocation(RUN_LOCATION);
  }

  public static getRunKey(): Registry {
    return new WinReg({
      hive: WinReg.HKLM,
      key: RUN_LOCATION
    });
  }

  public static getPidKey(): Registry {
    return new WinReg({
      hive: WinReg.HKLM,
      key: SERVICE_LOCATION
    });
  }

  private static initLocation(location: string) {
    const key = new WinReg({
      hive: WinReg.HKLM, //CurrentUser,
      key: location
    });
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    key.create(() => {});
    //todo research need of creation
  }
}

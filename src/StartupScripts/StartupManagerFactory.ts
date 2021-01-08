import { StartupManager } from './StartupManager';
import { PlatformUnsupportedError } from './PlatformUnsupportedError';
import { SCManager, SystemD, SystemV } from './Managers';
import { statSync } from 'fs';
import { platform } from 'os';

export class StartupManagerFactory {
  public create(options: {
    dispose?: () => Promise<unknown> | unknown;
  }): StartupManager {
    const os: NodeJS.Platform = platform();

    switch (os) {
      case 'win32':
        return new SCManager(options);
      case 'linux':
        return this.isSystemD() ? new SystemD(options) : new SystemV(options);
      default:
        throw new PlatformUnsupportedError(os);
    }
  }

  private isSystemD(): boolean {
    try {
      statSync('/usr/lib/systemd/system');

      return true;
    } catch {
      return false;
    }
  }
}

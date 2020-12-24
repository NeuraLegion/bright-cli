import { StartupManager } from './StartupManager';
import { OsServiceScriptManager } from './OsServiceScriptManager';
import { PlatformUnsupportedError } from './PlatformUnsupportedError';
import { platform } from 'os';

export class StartupManagerFactory {
  public create(): StartupManager {
    const os = platform();
    switch (os) {
      case 'win32' || 'linux': {
        return new OsServiceScriptManager();
      }
      default: {
        throw new PlatformUnsupportedError(os);
      }
    }
  }
}

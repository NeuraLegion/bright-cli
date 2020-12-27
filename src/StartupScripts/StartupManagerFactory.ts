import { StartupManager } from './StartupManager';
import { OsServiceScriptManager } from './OsServiceScriptManager';
import { PlatformUnsupportedError } from './PlatformUnsupportedError';
import { platform } from 'os';

export class StartupManagerFactory {
  public create(onDispose: () => Promise<void>): StartupManager {
    const os = platform();
    switch (os) {
      case 'win32':
      case 'linux':
        return new OsServiceScriptManager(onDispose);
      default:
        throw new PlatformUnsupportedError(os);
    }
  }
}

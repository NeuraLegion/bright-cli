import { StartupManager } from './StartupManager';
import { OsServiceScriptManager } from './OsServiceScriptManager';
import { PlatformUnsupportedError } from './PlatformUnsupportedError';
import { platform } from 'os';

export class StartupManagerFactory {
  public create(options: {
    dispose?: () => Promise<unknown> | unknown;
  }): StartupManager {
    const os: NodeJS.Platform = platform();

    switch (os) {
      case 'win32':
      case 'linux':
        return new OsServiceScriptManager(options);
      default:
        throw new PlatformUnsupportedError(os);
    }
  }
}

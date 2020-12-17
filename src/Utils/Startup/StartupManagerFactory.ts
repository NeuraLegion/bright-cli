import { ScriptManager } from './SсriptManager';
import { WindowsScriptManager } from './windows/WindowsScriptManager';
import { StartupScriptUnsupportedError } from './StartupScriptUnsupportedError';
import { RegistryPidStore } from './windows/RegistryPidStore';
import { platform } from 'os';

export class StartupManagerFactory {
  public static create(): ScriptManager {
    const os = platform();
    switch (os) {
      case 'win32': {
        return new WindowsScriptManager(new RegistryPidStore());
      }
      default: {
        throw new StartupScriptUnsupportedError(os);
      }
    }
  }
}

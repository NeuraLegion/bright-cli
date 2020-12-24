import { StartupManager } from './StartupManager';
import { StartupOptions } from './StartupOptions';
import service from 'os-service';
import { promisify } from 'util';

export class OsServiceScriptManager implements StartupManager {
  install(opts: StartupOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      service.add(
        opts.serviceName,
        {
          programArgs: opts.exeArgs,
          programPath: opts.exePath
        },
        (error: Error) => {
          if (error) {
            return reject(error);
          }
          resolve();
        }
      );
    });
  }

  run(): Promise<void> {
    return Promise.resolve(service.run(() => this.stop(0)));
  }

  async stop(code: number): Promise<void> {
    try {
      return service.stop(code);
    } catch {
      // noop: os-service does not have isExists method
    }
  }

  async uninstall(name: string): Promise<void> {
    try {
      await promisify(service.remove).call(this, name);
    } catch {
      // noop: os-service does not have isExists method
    }
  }
}

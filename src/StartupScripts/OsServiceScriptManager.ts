import { StartupManager } from './StartupManager';
import { StartupOptions } from './StartupOptions';
import service from 'os-service';
import { promisify } from 'util';

export class OsServiceScriptManager implements StartupManager {
  constructor(private readonly dispose: () => Promise<void> = null) {}

  public install(opts: StartupOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      service.add(
        opts.serviceName,
        {
          programArgs: opts.exeArgs,
          programPath: opts.exePath
        },
        (error) => {
          if (error) {
            return reject(error);
          }
          resolve();
        }
      );
    });
  }

  public run(): Promise<void> {
    return Promise.resolve(service.run(() => this.stop(0)));
  }

  public async stop(code: number): Promise<void> {
    try {
      if (this.dispose) {
        await this.dispose();
      }

      return service.stop(code);
    } catch {
      // noop: os-service does not have isExists method
    }
  }

  public async uninstall(name: string): Promise<void> {
    try {
      await promisify(service.remove)(name);
    } catch {
      // noop: os-service does not have isExists method
    }
  }
}

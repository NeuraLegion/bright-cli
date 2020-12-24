import { StartupManager } from './StartupManager';
import { StartupOptions } from './StartupOptions';
import { run, add, remove, stop, AddOptions } from 'os-service';
import { promisify } from 'util';

export class OsServiceScriptManager implements StartupManager {
  constructor(
    private readonly options?: {
      dispose?: () => Promise<unknown> | unknown;
    }
  ) {}

  public install(opts: StartupOptions): Promise<void> {
    return promisify<string, AddOptions>(add)(opts.serviceName, {
      programArgs: opts.exeArgs,
      programPath: opts.exePath
    });
  }

  public async run(): Promise<void> {
    run(() => this.stop(0));
  }

  public async stop(code: number): Promise<void> {
    try {
      if (this.options?.dispose) {
        await this.options.dispose();
      }

      return stop(code);
    } catch {
      // noop: os-service does not have isExists method
    }
  }

  public async uninstall(name: string): Promise<void> {
    try {
      await promisify(remove)(name);
    } catch {
      // noop: os-service does not have isExists method
    }
  }
}

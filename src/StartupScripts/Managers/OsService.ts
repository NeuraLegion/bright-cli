import { StartupManager } from '../StartupManager';
import { StartupOptions } from '../StartupOptions';
import { run, add, remove, stop, AddOptions } from '@neuralegion/os-service';
import { promisify } from 'util';

export abstract class OsService implements StartupManager {
  protected constructor(
    private readonly options?: {
      dispose?: () => Promise<unknown> | unknown;
    }
  ) {}

  protected abstract start(name: string): Promise<void>;
  protected abstract stop(name: string): Promise<void>;

  public async install({ name, ...options }: StartupOptions): Promise<void> {
    await promisify<string, AddOptions>(add)(name, options);
    await this.start(name);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async run(): Promise<void> {
    run(() => this.exit(0));
  }

  public async uninstall(name: string): Promise<void> {
    try {
      await this.stop(name);
      await promisify(remove)(name);
    } catch {
      // noop: os-service does not have isExists method
    }
  }

  private async exit(code: number): Promise<void> {
    if (this.options?.dispose) {
      await this.options.dispose();
    }

    stop(code);
  }
}

import { OsService } from './OsService';
import { exec } from 'child_process';
import { promisify } from 'util';

export class SystemV extends OsService {
  constructor(options?: { dispose?: () => Promise<unknown> | unknown }) {
    super(options);
  }

  protected async start(name: string): Promise<void> {
    await promisify(exec)(`service ${name} start`);
  }

  protected async stop(name: string): Promise<void> {
    await promisify(exec)(`service ${name} stop`);
  }
}

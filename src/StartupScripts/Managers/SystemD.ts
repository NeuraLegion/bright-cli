import { OsService } from './OsService';
import { exec } from 'child_process';
import { promisify } from 'util';

export class SystemD extends OsService {
  constructor(options?: { dispose?: () => Promise<unknown> | unknown }) {
    super(options);
  }

  protected async start(name: string): Promise<void> {
    await promisify(exec)(`systemctl start ${name}`);
  }

  protected async stop(name: string): Promise<void> {
    await promisify(exec)(`systemctl stop ${name}`);
  }
}

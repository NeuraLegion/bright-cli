import { ScriptLoader } from './ScriptLoader';
import { VirtualScripts } from './VirtualScripts';
import { logger } from '../Utils';
import { VirtualScriptType } from './VirtualScript';
import { inject, injectable } from 'tsyringe';
import { readFile } from 'fs';
import { promisify } from 'util';

@injectable()
export class FSScriptLoader implements ScriptLoader {
  constructor(
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts
  ) {}

  public async load(scripts: Record<string, string>): Promise<void> {
    await Promise.all(
      Object.entries(scripts).map(([wildcard, path]: [string, string]) =>
        this.loadScript(wildcard, path)
      )
    );
  }

  private async loadScript(wildcard: string, path: string): Promise<void> {
    let code: string;

    try {
      code = await promisify(readFile)(path, { encoding: 'utf8' });
    } catch (e) {
      logger.debug(`Cannot load ${path}. Error: ${e.message}`);
      throw new Error(`Error Loading Script: Cannot load ${path}`);
    }

    this.virtualScripts.set(wildcard, VirtualScriptType.LOCAL, code);
  }
}

import { sync } from 'find-up';
import { readFileSync } from 'fs';
import path from 'path';

export class CliInfo {
  public readonly cwd: string;
  public readonly version: string;
  private _pkgPath: string;

  constructor(cwd: string = process.cwd()) {
    this._pkgPath = this.getPkgPath(cwd);
    this.cwd = this._pkgPath ? path.dirname(this._pkgPath) : cwd;
    this.version = this.getVersion();
  }

  private getVersion(): string | undefined {
    try {
      const pkg = readFileSync(this._pkgPath, 'utf8');
      const { version } = JSON.parse(pkg);

      return version;
    } catch {
      // noop
    }
  }

  private getPkgPath(cwd?: string): string {
    return sync('package.json', {
      cwd: cwd || process.env.NEXPLOIT_CWD || process.cwd()
    });
  }
}

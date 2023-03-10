import { sync } from 'find-up';
import path from 'path';
import { readFileSync } from 'fs';

export class CliInfo {
  public readonly cwd: string;
  public readonly version: string;
  private _pkgPath: string;

  constructor(cwd: string = process.cwd()) {
    this._pkgPath = this.getPkgPath(cwd);
    this.cwd = this._pkgPath ? path.dirname(this._pkgPath) : cwd;
    this.version = process.env.VERSION ?? this.getVersion();
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
      cwd: cwd || process.env.BRIGHT_CWD || process.cwd()
    });
  }
}

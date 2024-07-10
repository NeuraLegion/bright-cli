import { sync } from 'find-up';
import path from 'node:path';
import { readFileSync } from 'node:fs';

export class CliInfo {
  public readonly cwd: string;
  public readonly version: string;
  public readonly distribution: string | undefined;

  constructor(cwd: string) {
    const packagePath = this.getPackagePath(cwd);
    const packageData = this.getPackageData(packagePath);

    this.cwd = packagePath ? path.dirname(packagePath) : cwd;
    this.version = process.env.VERSION ?? packageData?.version;
    this.distribution = packageData?.brightCli?.distribution;
  }

  private getPackageData(packagePath: string) {
    try {
      const pkg = readFileSync(packagePath, 'utf8');

      return JSON.parse(pkg);
    } catch {
      // noop
    }
  }

  private getPackagePath(cwd?: string): string {
    return sync('package.json', {
      cwd: cwd || process.env.BRIGHT_CWD || process.cwd()
    });
  }
}

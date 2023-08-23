import packageInfo from '../../package.json';
import { RuntimeDetector } from './RuntimeDetector';
import arch from 'arch';
import { execSync } from 'child_process';
import os from 'os';

export class DefaultRuntimeDetector implements RuntimeDetector {
  public distribution(): string | undefined {
    return packageInfo.brightCli.distribution;
  }

  public isInsideDocker(): boolean {
    return !!process.env['BRIGHT_CLI_DOCKER'];
  }

  public nodeVersion(): string {
    return process.version;
  }

  public arch(): string {
    try {
      return arch();
    } catch {
      // pass
    }

    // As a fallback use arch info for which the Node.js binary was compiled
    return os.arch();
  }

  public os(): string {
    const platform = os.platform();

    if (platform === 'darwin') {
      return this.detectMacosVersion();
    } else if (platform === 'linux') {
      return this.detectLinuxVersion();
    } else if (platform === 'win32') {
      return this.detectWindowsVersion();
    }

    // As a fallback use OS info for which the Node.js binary was compiled
    return `${os.platform()} (${os.release()})`;
  }

  private detectMacosVersion() {
    try {
      const name = execSync('sw_vers -productName', {
        encoding: 'utf8'
      }).trim();
      const version = execSync('sw_vers -productVersion', {
        encoding: 'utf8'
      }).trim();
      const build = execSync('sw_vers -buildVersion', {
        encoding: 'utf8'
      }).trim();

      if (name.length && version.length && build.length) {
        return `${name} ${version} (${build})`;
      }
    } catch {
      // pass
    }

    return `${os.platform()} (${os.release()})`;
  }

  private detectLinuxVersion() {
    try {
      const osRelease = execSync('cat /etc/os-release', {
        encoding: 'utf8'
      }).trim();
      const extractValue = (key: string) =>
        new RegExp(
          `(?:^|[\r\n]+)${key}(?:\\s*=\\s*?|:\\s+?)(\\s*'(?:\\\\'|[^'])*'|\\s*"(?:\\\\"|[^"])*"|\\s*\`(?:\\\\\`|[^\`])*\`|[^#\r\n]+)?`,
          'i'
        )
          .exec(osRelease)?.[1]
          .replace(/^(['"`])([\s\S]*)\1$/i, '$2');

      const name = extractValue('NAME') || extractValue('ID');
      const version = extractValue('VERSION') || extractValue('VERSION_ID');
      const prettyName = extractValue('PRETTY_NAME');

      if (name.length && version.length) {
        return `${name} ${version}`;
      } else if (prettyName.length) {
        return prettyName;
      }
    } catch {
      // pass
    }

    return `${os.platform()} (${os.release()})`;
  }

  private detectWindowsVersion() {
    try {
      const version = execSync('ver', { encoding: 'utf8' }).trim();

      if (version.length) {
        return version;
      }
    } catch {
      // pass
    }

    return `${os.platform()} (${os.release()})`;
  }
}

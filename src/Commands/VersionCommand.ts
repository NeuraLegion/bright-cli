import { logger } from '../Utils';
import { CommandModule } from 'yargs';
import { exec, ExecException } from 'child_process';

export class VersionCommand implements CommandModule {
  public readonly command = 'version';
  public readonly describe = 'Prints Bright CLI version this project uses.';

  protected static executeCommand(command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      exec(
        command,
        (error: ExecException | null, stdout: string, stderr: string) => {
          if (stdout) {
            return resolve(stdout);
          }

          if (stderr) {
            return resolve(stderr);
          }

          if (error) {
            return reject(error);
          }

          resolve('');
        }
      );
    });
  }

  private static getGlobalNpmVersion(globalNpmList: string) {
    const globalMatches: RegExpMatchArray | null = globalNpmList.match(
      / @neuralegion\/bright-cli@(.*)\n/
    );
    const globalNpmVersion: string = (
      globalMatches && globalMatches[1] ? globalMatches[1] : ''
    )
      .replace(/"invalid"/gi, '')
      .trim();

    return globalNpmVersion;
  }

  private static getLegacyGlobalNpmVersion(globalNpmList: string) {
    const legacyGlobalMatches: RegExpMatchArray | null = globalNpmList.match(
      / @neuralegion\/nexploit-cli@(.*)\n/
    );
    const legacyGlobalNpmVersion: string = (
      legacyGlobalMatches && legacyGlobalMatches[1]
        ? legacyGlobalMatches[1]
        : ''
    )
      .replace(/"invalid"/gi, '')
      .trim();

    return legacyGlobalNpmVersion;
  }

  private static async getLocalNpmVersion() {
    const localNpmList: string = await VersionCommand.executeCommand(
      'npm list --depth=0'
    );
    const localMatches: RegExpMatchArray | null = localNpmList.match(
      / @nexploit\/cli@(.*)\n/
    );
    const localNpmVersion: string = (
      localMatches && localMatches[1] ? localMatches[1] : ''
    )
      .replace(/"invalid"/gi, '')
      .trim();

    return localNpmVersion;
  }

  public async handler(): Promise<void> {
    const localNpmVersion = await VersionCommand.getLocalNpmVersion();

    const globalNpmList: string = await VersionCommand.executeCommand(
      'npm list -g --depth=0'
    );
    const legacyGlobalNpmVersion =
      VersionCommand.getLegacyGlobalNpmVersion(globalNpmList);
    const globalNpmVersion = VersionCommand.getGlobalNpmVersion(globalNpmList);

    if (localNpmVersion) {
      logger.log('Local installed version:', localNpmVersion);
    } else {
      logger.warn('No local installed Bright CLI was found.');
    }

    if (globalNpmVersion) {
      logger.log('Global installed Bright CLI version:', globalNpmVersion);
    } else if (legacyGlobalNpmVersion) {
      logger.warn(
        `Legacy NexPloit CLI found with version: ${legacyGlobalNpmVersion}. Install new Bright CLI: https://github.com/NeuraLegion/bright-cli#1-install-bright-cli-globally.`
      );
    } else {
      logger.warn('No global installed was found.');
    }

    if (
      localNpmVersion &&
      globalNpmVersion &&
      localNpmVersion !== globalNpmVersion
    ) {
      logger.warn(
        'To avoid issues with CLI please make sure your global and local Bright CLI versions match, ' +
          'or you are using locally installed Bright CLI instead of global one.'
      );
    }
  }
}

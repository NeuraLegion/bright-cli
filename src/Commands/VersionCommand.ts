import { logger } from '../Utils';
import { CommandModule } from 'yargs';
import { exec, ExecException } from 'child_process';

export class VersionCommand implements CommandModule {
  public readonly command = 'version';
  public readonly describe = 'Prints NexPloit CLI version this project uses.';

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

  public async handler(): Promise<void> {
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

    const globalNpmList: string = await VersionCommand.executeCommand(
      'npm list -g --depth=0'
    );
    const globalMatches: RegExpMatchArray | null = globalNpmList.match(
      / @nexploit\/cli@(.*)\n/
    );
    const globalNpmVersion: string = (
      globalMatches && globalMatches[1] ? globalMatches[1] : ''
    )
      .replace(/"invalid"/gi, '')
      .trim();

    if (localNpmVersion) {
      logger.log('Local installed version:', localNpmVersion);
    } else {
      logger.warn('No local installed NexPloit CLI was found.');
    }

    if (globalNpmVersion) {
      logger.log('Global installed NexPloit CLI version:', globalNpmVersion);
    } else {
      logger.warn('No global installed was found.');
    }

    if (
      localNpmVersion &&
      globalNpmVersion &&
      localNpmVersion !== globalNpmVersion
    ) {
      logger.warn(
        'To avoid issues with CLI please make sure your global and local NexPloit CLI versions match, ' +
          'or you are using locally installed NexPloit CLI instead of global one.'
      );
    }
  }
}

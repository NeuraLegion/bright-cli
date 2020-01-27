import { exec, ExecException } from 'child_process';
import yargs from 'yargs';

export class VersionCommand implements yargs.CommandModule {
  public readonly command = 'version';
  public readonly describe = 'Prints NexPloit version this project uses.';

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
    const localNpmVersion: string = (localMatches && localMatches[1]
      ? localMatches[1]
      : ''
    )
      .replace(/"invalid"/gi, '')
      .trim();

    const globalNpmList: string = await VersionCommand.executeCommand(
      'npm list -g --depth=0'
    );
    const globalMatches: RegExpMatchArray | null = globalNpmList.match(
      / @nexploit\/cli@(.*)\n/
    );
    const globalNpmVersion: string = (globalMatches && globalMatches[1]
      ? globalMatches[1]
      : ''
    )
      .replace(/"invalid"/gi, '')
      .trim();

    if (localNpmVersion) {
      console.log('Local installed version:', localNpmVersion);
    } else {
      console.log('No local installed NexPloit was found.');
    }

    if (globalNpmVersion) {
      console.log('Global installed NexPloit version:', globalNpmVersion);
    } else {
      console.log('No global installed was found.');
    }

    if (
      localNpmVersion &&
      globalNpmVersion &&
      localNpmVersion !== globalNpmVersion
    ) {
      console.log(
        'To avoid issues with CLI please make sure your global and local NexPloit versions match, ' +
          'or you are using locally installed NexPloit instead of global one.'
      );
    }
  }
}

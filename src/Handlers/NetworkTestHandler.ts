import { bind, Handler } from '../Bus';
import { NetworkTest } from './Events';
import { NetworkTestResult } from '../Integrations';
import { ReadlinePlatform } from '../Wizard';
import { Helpers, logger } from '../Utils';
import { injectable } from 'tsyringe';
import { EOL } from 'os';

@injectable()
@bind(NetworkTest)
export class NetworkTestHandler
  implements Handler<NetworkTest, NetworkTestResult>
{
  public async handle({
    repeaterId,
    urls
  }: NetworkTest): Promise<NetworkTestResult> {
    const output = await this.getOutput(urls);

    return { output, repeaterId };
  }

  private async getOutput(urls: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['configure', '--ping'];

      logger.debug('Launching "Network Diagnostic" process with cmd: %j', args);

      const child = Helpers.spawn({
        include: args,
        exclude: ['repeater']
      });

      child.unref();

      const stdout: string[] = [];

      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        const lines: string[] = chunk
          .split('\n')
          .filter((line: string) => line.length > 0);

        stdout.push(...lines);

        if (chunk.indexOf(ReadlinePlatform.URLS_QUESTION) > -1) {
          child.stdin.write(`${urls.join(',')}${EOL}`);
        }

        if (chunk.indexOf(ReadlinePlatform.COMPELED_MESSAGE) > -1) {
          child.stdin.end();
        }
      });

      child.once('error', (err: Error) => {
        logger.warn(
          `Failed to start "Network Diagnostic" due to %s`,
          err.message
        );
        reject(err);
      });

      child.on('close', (code: number) => {
        if (code !== 0 || stdout.length === 0) {
          const msg = `"Network Diagnostic" did not start successfully. Process exited with code ${code}`;

          logger.warn(msg);

          return reject(new Error(msg));
        }

        resolve(this.processOutput(stdout));
      });
    });
  }

  // this is workaround of \x1B[1G control code that retype string in console
  private processOutput(input: string[]): string {
    return input
      .filter(
        (element, index, arr) =>
          !(
            element.endsWith('\u001b[1G') ||
            (!!arr[index + 1] && arr[index + 1] === '\u001b[1G')
          )
      )
      .filter((x) => !x.startsWith(ReadlinePlatform.URLS_QUESTION))
      .join('\n');
  }
}

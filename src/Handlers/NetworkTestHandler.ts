import { bind, Handler } from '../Bus';
import { NetworkTest } from './Events';
import { NetworkTestResult } from '../Integrations';
import { ReadlinePlatform } from '../Wizard';
import { injectable } from 'tsyringe';
import { spawn } from 'nexpect';


@injectable()
@bind(NetworkTest)
export class NetworkTestHandler
  implements Handler<NetworkTest, NetworkTestResult> {
  public async handle({
    repeaterId,
    urls
  }: NetworkTest): Promise<NetworkTestResult> {
    const output = await this.getOutput(urls);

    return { output, repeaterId };
  }

  private async getOutput(urls: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const commandIndex = process.argv.indexOf('repeater');
      const args = process.argv
        .filter((_, i)=> i < commandIndex)
        .concat(['configure', '--nogui', '--network-only']);
      spawn(args.join(' '))
        .wait(ReadlinePlatform.URL_QUESTION)
        .sendline(urls.join(','))
        .wait(ReadlinePlatform.COMPELED_MESSAGE)
        .sendEof()
        .run((err, output, exit) => {
          console.log(err, output, exit);

          if (err) {
            return reject(err);
          }
          if (exit !== 0) {
            return reject(`Process finished with code: ${exit}`);
          }

          resolve(this.processOutput(output));
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
      .filter((x) => !x.startsWith(ReadlinePlatform.URL_QUESTION))
      .join('\n');
  }
}

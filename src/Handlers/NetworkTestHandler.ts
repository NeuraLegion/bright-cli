import { bind, Handler } from '../Bus';
import { NetworkTestIntegrationEvent } from './Events';
import { NetworkTestResult } from '../Integrations';
import { ReadlinePlatform } from '../Wizard';
import { Helpers } from '../Utils';
import { injectable } from 'tsyringe';
import { spawn } from 'nexpect';

@injectable()
@bind(NetworkTestIntegrationEvent)
export class NetworkTestHandler
  implements Handler<NetworkTestIntegrationEvent, NetworkTestResult> {

  public async handle({ repeaterId, urls }: NetworkTestIntegrationEvent): Promise<NetworkTestResult> {
    const output = await this.getOutput(urls);

    return { output, repeaterId };
  }

  private async getOutput(urls: string[]): Promise<string> {
    return new Promise((resolve, reject) => {

      const args = Helpers.getExecArgs({
        excludeAll: true,
        include: ['configure', '--nogui', '--networkonly']
      });

      console.log(args);
      const child = spawn(args.command, args.args)
        .wait(ReadlinePlatform.URL_QUESTION)
        .sendline(urls.join(','))
        .wait(ReadlinePlatform.COMPELED_MESSAGE)
        .sendEof()
        .run((err, output, exit) => {
          console.log(err, output, exit)
          if (err) {
            return reject(err);
          }
          resolve(output.join('\n'));
        });

      child.on('error', reject);
    });
  }
}
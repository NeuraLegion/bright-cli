import { bind, Handler } from '../Bus';
import { NetworkTestIntegrationEvent } from './Events';
import { NetworkTestResult } from '../Integrations';
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
      //TODO refactor wait to regexp
      //TODO remove node exec args
      //TODO make run without repeater params
      const child = spawn(process.argv[0],
        ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', './src/index.ts', 'configure', '--nogui'])
        .wait('Please enter your Repeater ID: ')
        .sendline('123')
        .wait('Please enter your Repeater API Token: ')
        .sendline('213')
        .wait('Please enter the target URLs to test (separated by commas): ')
        .sendline(urls.join(','))
        .wait('Communication diagnostics done, close the terminal to exit.')
        .sendEof()
        .run((err, output, exit) => {
          console.log(err, output, exit);
          if (err) {
            return reject(err);
          }
          resolve(output.join('\n'));
        });

      child.on('error', (err) => {
        reject(err);
      });
    });

  }
}

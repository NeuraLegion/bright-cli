import { RepeaterCommandHub } from './RepeaterCommandHub';
import { NetworkTestType } from './NetworkTestType';
import { VirtualScripts, VirtualScriptType } from '../Scripts';
import { Helpers, logger } from '../Utils';
import { ReadlinePlatform } from '../Wizard';
import { Request, RequestExecutor, Response } from '../RequestExecutor';
import { inject, injectable, injectAll } from 'tsyringe';
import { EOL } from 'os';
import { URL } from 'url';

@injectable()
export class DefaultRepeaterCommandHub implements RepeaterCommandHub {
  constructor(
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts,
    @injectAll(RequestExecutor)
    private readonly requestExecutors: RequestExecutor[]
  ) {}

  public compileScripts(script: string | Record<string, string>): void {
    this.virtualScripts.clear(VirtualScriptType.REMOTE);

    if (this.virtualScripts.size) {
      logger.warn(
        'Error Loading Script: Cannot accept scripts from the cloud when a local script is already loaded'
      );

      return;
    }

    if (typeof script === 'string') {
      this.virtualScripts.set('*', VirtualScriptType.REMOTE, script);
    } else {
      Object.entries(script).map(([wildcard, code]: [string, string]) =>
        this.virtualScripts.set(wildcard, VirtualScriptType.REMOTE, code)
      );
    }
  }

  public sendRequest(request: Request): Promise<Response> {
    const { protocol } = request;

    const requestExecutor = this.requestExecutors.find(
      (x) => x.protocol === protocol
    );

    if (!requestExecutor) {
      throw new Error(`Unsupported protocol "${protocol}"`);
    }

    return requestExecutor.execute(request);
  }

  public testNetwork(
    type: NetworkTestType,
    input: string | string[]
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['configure', `--${type}`];

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

        const [first, ...rest]: string[] = [].concat(input);

        if (chunk.indexOf(ReadlinePlatform.URLS_QUESTION) > -1) {
          child.stdin.write(`${[first, ...rest].join(',')}${EOL}`);
        }

        if (chunk.indexOf(ReadlinePlatform.HOST_OR_IP_QUESTION) > -1) {
          child.stdin.write(`${new URL(first).hostname}${EOL}`);
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

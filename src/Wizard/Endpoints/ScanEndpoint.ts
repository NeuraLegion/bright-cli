import { Endpoint } from './Endpoint';
import { Credentials, ScanId, ScannedUrl } from '../Models';
import logger from '../../Utils/Logger';
import { Tokens } from '../Tokens';
import Koa from 'koa';
import { ChildProcess, spawn } from 'child_process';
import { URL } from 'url';

export class ScanEndpoint implements Endpoint {
  private repeaterProcess: ChildProcess;

  constructor(private readonly tokens: Tokens) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    const tokens: Credentials | undefined = this.tokens.readTokens();

    if (!tokens) {
      ctx.throw(403, 'Authentication is required.');

      return;
    }

    if (!this.executeRepeater(tokens)) {
      ctx.throw(500, 'Could not start Repeater');

      return;
    }

    const { url }: ScannedUrl = ctx.request.body;

    try {
      new URL(url);
    } catch {
      ctx.throw(400, 'Invalid URL.');

      return;
    }

    let scanId: string | undefined;

    try {
      scanId = await this.launchScan(url, tokens);
    } catch (err) {
      logger.debug(`Cannot start a scan on %s. Error: %s`, url, err.message);

      ctx.throw(400, 'Cannot start a scan.');

      return;
    }

    ctx.body = {
      scanId
    } as ScanId;
  }

  private executeRepeater({ authToken, repeaterId }: Credentials): boolean {
    if (this.repeaterProcess && this.repeaterProcess.exitCode == null) {
      logger.debug(
        `Repeater process is still running (PID ${this.repeaterProcess.pid}). Skipping spawning another one`
      );

      return true;
    }

    const {
      cmd,
      argv: nodeArgv
    }: { cmd: string; argv: string[] } = this.getNodeExec();
    const args: string[] = [
      ...nodeArgv,
      'repeater',
      '--token',
      authToken,
      '--agent',
      repeaterId
    ];

    logger.debug(
      'Launching Repeater process with cmd: %s and arguments: %j',
      cmd,
      args
    );

    try {
      this.repeaterProcess = spawn(cmd, args, {
        detached: true
      });

      this.repeaterProcess.unref();

      this.repeaterProcess.once('close', (code: number, signal: string) =>
        logger.log(
          `Repeater process closed with exit code %s due to %s signal`,
          code,
          signal
        )
      );
      this.repeaterProcess.once('error', (err: Error) =>
        logger.log(`Failed to start Repeater process due to %s`, err.message)
      );
      this.repeaterProcess.on('exit', (code: number) =>
        logger.log(`Repeater process exited with exit code %s`, code)
      );

      logger.log(
        `Launched Repeater process (PID %s)`,
        this.repeaterProcess.pid
      );

      return true;
    } catch (err) {
      logger.error(`Failed to launch Repeater process. Error: %s`, err.message);

      return false;
    }
  }

  private async launchScan(
    url: string,
    { authToken, repeaterId }: Credentials
  ): Promise<string> {
    const { cmd, argv: nodeArgv } = this.getNodeExec();
    const args: string[] = [
      ...nodeArgv,
      'scan:run',
      '--token',
      authToken,
      '--name',
      '"My First Demo Scan"',
      '--repeater',
      repeaterId,
      '--crawler',
      url,
      '--smart',
      '--test',
      'header_security'
    ];

    logger.debug(
      `Launching scanner process with cmd: %s and arguments: %j`,
      cmd,
      args
    );

    return new Promise<string>((resolve, reject) => {
      try {
        const scanProcess: ChildProcess = spawn(cmd, args);

        const output: Buffer[] = [];

        scanProcess.stdout.on('data', (data: Buffer) => {
          logger.debug('Scanner (stdout): %s', data);
          output.push(data);
        });

        scanProcess.on('error', (err: Error) => {
          logger.warn(`Failed to start Scanner process due to %s`, err.message);
          reject(err);
        });

        scanProcess.on('exit', (code: number) => {
          const response: string = Buffer.concat(output).toString('utf8');

          if (code !== 0 || response.length === 0) {
            const msg = `Scan did not start successfully. Process exited with code ${code} and output ${response}`;

            logger.warn(msg);

            return reject(new Error(msg));
          }

          const scanId: string = response.split('\n').pop();

          resolve(scanId);
        });
      } catch (err) {
        logger.error(
          `Failed to launch Scanner process. Error message ${err.message}`
        );
        reject(
          new Error(
            `Failed to launch Scanner process. Error message ${err.message}`
          )
        );
      }
    });
  }

  private getNodeExec(): { cmd: string; argv: string[] } {
    const args: string[] = [];

    // to support standalone 'node ./dist/index.js configure' execution
    for (let i = 0; i < process.argv.length; i++) {
      if (process.argv[i] === 'configure') {
        break;
      }

      args.push(process.argv[i]);
    }

    const cmd: string = args.shift();

    return {
      cmd,
      argv: [...process.execArgv, ...args]
    };
  }
}

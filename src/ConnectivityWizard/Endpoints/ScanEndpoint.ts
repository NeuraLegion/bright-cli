import { Endpoint } from './Endpoint';
import { ScannedUrl } from '../Entities/ScannedUrl';
import { Credentials } from '../Entities/Credentials';
import { ScanId } from '../Entities/ScanId';
import logger from '../../Utils/Logger';
import { Tokens } from '../Tokens';
import Koa from 'koa';
import { ChildProcess, spawn } from 'child_process';

export class ScanEndpoint implements Endpoint {
  private repeaterProcess: ChildProcess;

  constructor(private readonly tokens: Tokens) {}

  public async handle(ctx: Koa.Context): Promise<void> {
    const tokens: Credentials | undefined = this.tokens.readTokens();

    if (!tokens) {
      ctx.throw(403, 'Authentication is required.');

      return;
    }

    const req = <ScannedUrl>ctx.request.body;

    let scanId: string | undefined;

    if (!this.executeRepeater(tokens)) {
      ctx.throw('Could not execute Repeater');

      return;
    }

    try {
      scanId = await this.launchScan(req.url, tokens);
    } catch (err) {
      ctx.status = 400;

      return;
    }

    ctx.body = {
      scanId
    } as ScanId;
  }

  private executeRepeater(tokens: Credentials): boolean {
    if (this.repeaterProcess != null && this.repeaterProcess.exitCode == null) {
      logger.debug(
        `Repeater process is still runnning (PID ${this.repeaterProcess.pid}). Skippiing spawning another one`
      );

      return true;
    }

    const node_exec = this.getNodeExec();

    try {
      const startArgs: string[] = [
        ...node_exec.argv,
        'repeater',
        '--token',
        tokens.authToken,
        '--agent',
        tokens.repeaterId
      ];
      logger.debug(
        'Launching Repeater process with cmd: %s and arguments: %j',
        node_exec.cmd,
        startArgs
      );

      this.repeaterProcess = spawn(node_exec.cmd, startArgs, {
        detached: true
      });

      this.repeaterProcess.stdout.on('data', (data) => {
        const line = data.toString();
        logger.debug('Repeater (stdout): %s', line);
      });
      this.repeaterProcess.stderr.on('data', (data) => {
        const line = data.toString();
        logger.error(`Repeater (stderr): ${line}`);
      });

      this.repeaterProcess.unref();

      let fired = false;

      this.repeaterProcess.on('close', (code, signal) => {
        !fired &&
          logger.log(
            `Repeater process closed with exit code ${code} due to ${signal} signal`
          );
        fired = true;
      });
      this.repeaterProcess.on('error', (err: Error) => {
        !fired &&
          logger.log(`Failed to start repeater process due to ${err.message}`);
        fired = true;
      });
      this.repeaterProcess.on('exit', (code) => {
        !fired && logger.log(`Repeater process exited with exit code ${code}`);
        fired = true;
      });
      logger.log(`Launched Repeater process (PID ${this.repeaterProcess.pid})`);

      return true;
    } catch (err) {
      logger.error(`Failed to launch Repeater process. Error: ${err.message}`);

      return false;
    }
  }

  private async launchScan(url: string, tokens: Credentials): Promise<string> {
    const nodeExec = this.getNodeExec();
    const args: string[] = [
      ...nodeExec.argv,
      'scan:run',
      '--token',
      tokens.authToken,
      '--name',
      '"My First Demo Scan"',
      '--agent',
      tokens.repeaterId,
      '--crawler',
      url,
      '--smart',
      '--test',
      'header_security'
    ];

    logger.debug(
      `Launching scanner process with cmd: ${
        nodeExec.cmd
      } and arguments: ${JSON.stringify(args)}`
    );

    return new Promise((resolve, reject) => {
      try {
        const p: ChildProcess = spawn(nodeExec.cmd, args);
        const output: string[] = [];

        p.stdout.on('data', (data: any) => {
          const line = data.toString();
          logger.debug('Scanner (stdout): %s', line);
          output.push(line);
        });
        p.stderr.on('data', (data: any) => {
          const line = data.toString();
          logger.debug('Scanner (stderr): %s', line);
        });

        p.on('error', (err: Error) => {
          logger.warn(`Failed to start Scanner process due to ${err.message}`);
          reject(err);
        });
        p.on('exit', (code: number) => {
          if (code !== 0 || output.length === 0) {
            const msg = `Scan did not start succesfully. Process exited with code ${code} and output ${JSON.stringify(
              output
            )}`;

            logger.warn(msg);

            reject(new Error(msg));
          } else {
            resolve(output.pop());
          }
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
    const startArgs: string[] = [];
    //to support standalone 'node ./dist/index.js configure' execution
    for (let i = 0; i < process.argv.length; i++) {
      if (process.argv[i] === 'configure') {
        break;
      }
      startArgs.push(process.argv[i]);
    }
    const cmd: string = startArgs.shift();

    return {
      cmd,
      argv: startArgs
    };
  }
}

import { Endpoint } from './Endpoint';
import { ScannedUrl } from '../Entities/ScannedUrl';
import { Tokens } from '../Entities/Tokens';
import { ScanId } from '../Entities/ScanId';
import { TokensOperations } from '../TokensOperations';
import logger from '../../Utils/Logger';
import Koa from 'koa';
import child_processes from 'child_process';

export class ScanEndpoint implements Endpoint {
  private tokenOperations: TokensOperations;
  private repeaterProcess: child_processes.ChildProcess;

  constructor(tokenOps: TokensOperations) {
    this.tokenOperations = tokenOps;
  }

  public async handle(ctx: Koa.Context): Promise<void> {
    const req = <ScannedUrl>ctx.request.body;
    const tokens: Tokens = this.tokenOperations.readTokens();
    let scan_id: string = null;

    if (!this.executeRepeater(tokens)) {
      ctx.throw('Could not execute Repeater');

      return;
    }

    try {
      scan_id = await this.launchScan(req.url, tokens);
    } catch (err) {
      ctx.status = 400;

      return;
    }

    ctx.body = <ScanId>{
      scanId: scan_id
    };
  }

  private executeRepeater(tokens: Tokens): boolean {
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
        `"${tokens.authToken}"`,
        '--agent',
        `"${tokens.repeaterId}`
      ];
      logger.debug(
        `Launching Repeater process with cmd: ${
          node_exec.cmd
        } and arguments: ${JSON.stringify(startArgs)}`
      );

      this.repeaterProcess = child_processes.spawn(node_exec.cmd, startArgs, {
        detached: true
      });

      this.repeaterProcess.stdout.on('data', (data) => {
        const line = data.toString();
        logger.debug(`Repeater (stdout): ${line}`);
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

  private async launchScan(url: string, tokens: Tokens): Promise<string> {
    const nodeExec = this.getNodeExec();
    const args: string[] = [
      ...nodeExec.argv,
      'scan:run',
      '--token',
      `"${tokens.authToken}"`,
      '--name',
      '"My First Demo Scan"',
      '--agent',
      `"${tokens.repeaterId}"`,
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
        const p: child_processes.ChildProcess = child_processes.spawn(
          nodeExec.cmd,
          args
        );
        const output: string[] = [];

        p.stdout.on('data', (data: any) => {
          const line = data.toString();
          logger.debug(`Scanner (stdout): ${line}`);
          output.push(line);
        });
        p.stderr.on('data', (data: any) => {
          const line = data.toString();
          logger.debug(`Scanner (stderr): ${line}`);
        });

        p.on('error', (err: Error) => {
          logger.warn(`Failed to start Scanner process due to ${err.message}`);
          reject();
        });
        p.on('exit', (code: number) => {
          if (code !== 0 || output.length === 0) {
            logger.warn(
              `Scan did not start succesfully. Process exited with code ${code} and output ${JSON.stringify(
                output
              )}`
            );
            reject();
          } else {
            resolve(output.pop());
          }
        });
      } catch (err) {
        logger.error(
          `Failed to launch Scanner process. Error message ${err.message}`
        );
        reject();
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

import { Endpoint } from './Endpoint';
import { Credentials, ScanId, ScannedUrl } from '../../../Models';
import { Helpers, logger } from '../../../../Utils';
import { Tokens } from '../../../Tokens';
import Koa from 'koa';
import { inject, injectable } from 'tsyringe';
import { ChildProcess } from 'child_process';
import { URL } from 'url';

@injectable()
export class ScanEndpoint implements Endpoint {
  private repeaterProcess: ChildProcess;

  constructor(@inject(Tokens) private readonly tokens: Tokens) {}

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

    try {
      const args = ['repeater', '--token', authToken, '--agent', repeaterId];

      logger.debug('Launching "Repeater" process with cmd: %j', args);

      this.repeaterProcess = Helpers.spawn({
        include: args,
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
    return new Promise<string>((resolve, reject) => {
      try {
        const args = [
          'scan:run',
          '--token',
          authToken,
          '--name',
          'My First Demo Scan',
          '--repeater',
          repeaterId,
          '--crawler',
          url,
          '--smart',
          '--test',
          'header_security'
        ];

        logger.debug('Launching "Scan" process with cmd: %j', args);

        const child = Helpers.spawn({
          include: args
        });

        const output: Buffer[] = [];

        child.stdout.on('data', (data: Buffer) => {
          logger.debug('Scanner (stdout): %s', data);
          output.push(data);
        });

        child.on('error', (err: Error) => {
          logger.warn(`Failed to start Scanner process due to %s`, err.message);
          reject(err);
        });

        child.on('exit', (code: number) => {
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
}

import concat from 'concat-stream';
import { ChildProcess, spawn } from 'child_process';

export class Cli {
  constructor(
    public readonly execPath = process.execPath,
    public readonly execArgs: readonly string[] = process.execArgv
  ) {}

  public spawn(
    command: string,
    args: string[] = [],
    env: Record<string, string> = null
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child: ChildProcess = this.createProcess([command, ...args], env);

      child.unref();

      child.stderr.once('data', (data: Buffer) =>
        reject(new Error(data.toString()))
      );
      child.once('error', reject);
      child.stdout.pipe(concat((result: Buffer) => resolve(result.toString())));
    });
  }

  private createProcess(
    args: string[] = [],
    env: Record<string, string> = null
  ): ChildProcess {
    const execArgs = [...this.execArgs].concat(args);

    return spawn(this.execPath, execArgs, {
      env: {
        NODE_ENV: 'test',
        ...env
      }
    });
  }
}

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
  ): ChildProcess {
    const child: ChildProcess = this.createProcess([command, ...args], env);
    child.unref();

    return child;
  }

  public exec(
    command: string,
    args: string[] = [],
    env: Record<string, string> = null
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const result: string[] = [];

      const child: ChildProcess = this.createProcess([command, ...args], env);

      child.unref();

      child.stderr.on('data', (data: Buffer) => {
        result.push(data.toString());
      });

      child.stdout.on('data', (data: Buffer) => {
        result.push(data.toString());
      });

      child.once('error', reject);
      child.once('close', () => {
        resolve(result.join(''));
      });
    });
  }

  private createProcess(
    args: string[] = [],
    env: Record<string, string> = null
  ): ChildProcess {
    const execArgs = [...this.execArgs].concat(args);

    return spawn(this.execPath, execArgs, {
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ...env
      }
    });
  }
}

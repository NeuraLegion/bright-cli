import chalk from 'chalk';
import debug, { Debugger } from 'debug';

const log: Debugger = debug('nexploit-cli:bus');

export class Logger {
  get logLevel(): string {
    return process.env.npm_config_loglevel || 'notice';
  }

  public error(message: string, ...args: any[]): void {
    console.log(chalk.red(message), ...args);
  }

  public warn(message: string, ...args: any[]): void {
    if (this.logLevel === 'silent') {
      return;
    }

    console.log(chalk.yellow(message), ...args);
  }

  public log(message: string, ...args: any[]): void {
    if (this.logLevel === 'silent' || this.logLevel === 'warn') {
      return;
    }
    console.log(message, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    log(message, ...args);
  }
}

const logger: Logger = new Logger();

export default logger;

import chalk from 'chalk';
import debug, { Debugger } from 'debug';

const log: Debugger = debug('nexploit-cli');

export enum LogLevel {
  SILENT,
  ERROR,
  WARN,
  NOTICE,
  VERBOSE
}

export class Logger {
  constructor(private readonly logLevel: LogLevel = LogLevel.NOTICE) {}

  public error(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.ERROR) {
      return;
    }

    console.log(chalk.red(message), ...args);
  }

  public warn(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.WARN) {
      return;
    }

    console.log(chalk.yellow(message), ...args);
  }

  public log(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.NOTICE) {
      return;
    }

    console.log(message, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.VERBOSE) {
      return;
    }

    log(message, ...args);
  }
}

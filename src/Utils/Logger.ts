import chalk from 'chalk';
import { format } from 'util';

export enum LogLevel {
  SILENT,
  ERROR,
  WARN,
  NOTICE,
  VERBOSE
}

export class Logger {
  private MAX_FORMATTED_LEVEL_LENGTH = Object.keys(LogLevel)
    .sort((a: string, b: string) => a.length - b.length)
    .slice(0)
    .pop().length;

  get logLevel(): LogLevel {
    return this._logLevel;
  }

  set logLevel(value: LogLevel) {
    this._logLevel = value;
  }

  private _logLevel: LogLevel;

  constructor(logLevel: LogLevel = LogLevel.NOTICE) {
    this._logLevel = logLevel;
  }

  public error(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.ERROR) {
      return;
    }

    this.write(message, LogLevel.ERROR, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.WARN) {
      return;
    }

    this.write(message, LogLevel.WARN, ...args);
  }

  public log(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.NOTICE) {
      return;
    }

    this.write(message, LogLevel.NOTICE, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.VERBOSE) {
      return;
    }

    this.write(message, LogLevel.VERBOSE, ...args);
  }

  private write(message: string, level: LogLevel, ...args: any[]): void {
    console.log(`${this.formatHeader(level)} - ${message}`, ...args);
  }

  private formatHeader(level: LogLevel): string {
    const header = format('[%s] [%s]', new Date(), this.formattedLevel(level));

    switch (level) {
      case LogLevel.ERROR:
        return chalk.red(header);
      case LogLevel.WARN:
        return chalk.yellow(header);
      case LogLevel.NOTICE:
        return chalk.green(header);
      case LogLevel.VERBOSE:
        return chalk.cyan(header);
    }
  }

  private formattedLevel(level: LogLevel): string {
    return LogLevel[level]
      .toString()
      .toUpperCase()
      .padEnd(this.MAX_FORMATTED_LEVEL_LENGTH, ' ');
  }
}

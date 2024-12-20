import chalk from 'chalk';
import { format } from 'node:util';

export enum LogLevel {
  SILENT,
  ERROR,
  WARN,
  NOTICE,
  VERBOSE,
  TRACE
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

  public error(error: Error, message?: string, ...args: any[]): void;
  public error(message: string, ...args: any[]): void;
  public error(
    errorOrMessage: Error | string,
    messageOrArg: any,
    ...args: any[]
  ): void {
    if (this.logLevel < LogLevel.ERROR) {
      return;
    }

    let message: string;

    if (typeof errorOrMessage === 'string') {
      if (arguments.length > 1) {
        args.unshift(messageOrArg);
      }

      message = errorOrMessage;
    } else {
      message = messageOrArg ?? errorOrMessage.message;
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

  public trace(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.TRACE) {
      return;
    }

    this.write(message, LogLevel.TRACE, ...args);
  }

  private write(message: string, level: LogLevel, ...args: any[]): void {
    const logMessage = `${this.formatHeader(level)} - ${message}`;

    if (level <= LogLevel.WARN) {
      // write to stderr for errors and warnings
      // eslint-disable-next-line no-console
      console.error(logMessage, ...args);

      return;
    }

    // eslint-disable-next-line no-console
    console.log(logMessage, ...args);
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
      case LogLevel.TRACE:
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

export const logger: Logger = new Logger();

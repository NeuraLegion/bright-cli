import chalk from 'chalk';
import { format } from 'node:util';
import { createWriteStream, WriteStream, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export enum LogLevel {
  SILENT,
  ERROR,
  WARN,
  NOTICE,
  VERBOSE,
  TRACE
}

export interface LogFile {
  write(data: string): void;
}

export class Logger {
  private MAX_FORMATTED_LEVEL_LENGTH = Object.keys(LogLevel)
    .sort((a: string, b: string) => a.length - b.length)
    .slice(0)
    .pop().length;

  private _logLevel: LogLevel;
  private _logFile?: LogFile;

  constructor(logLevel: LogLevel = LogLevel.NOTICE, logFile?: string) {
    this._logLevel = logLevel;
    if (logFile) {
      this.logFile = logFile;
    }
  }

  get logLevel(): LogLevel {
    return this._logLevel;
  }

  set logLevel(value: LogLevel) {
    this._logLevel = value;
  }

  get logFile(): string | undefined {
    return this._logFile && 'path' in this._logFile
      ? (this._logFile as any).path
      : undefined;
  }

  set logFile(filePath: string | undefined) {
    if (this._logFile && 'end' in this._logFile) {
      (this._logFile as WriteStream).end();
    }
    this._logFile = undefined;

    if (filePath) {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      this._logFile = createWriteStream(filePath, { flags: 'a' });
    }
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
      const error = errorOrMessage as Error;
      message = messageOrArg || error.message;
      if (error.stack) {
        args.push(`\n${error.stack}`);
      }
    }

    const formatted = this.formatMessage('ERROR', message, args);
    this.writeToStderr(chalk.red(formatted));
    this.writeToFile(formatted);
  }

  public warn(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.WARN) {
      return;
    }

    const formatted = this.formatMessage('WARN', message, args);
    this.writeToStdout(chalk.yellow(formatted));
    this.writeToFile(formatted);
  }

  public log(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.NOTICE) {
      return;
    }

    const formatted = this.formatMessage('NOTICE', message, args);
    this.writeToStdout(chalk.green(formatted));
    this.writeToFile(formatted);
  }

  public debug(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.VERBOSE) {
      return;
    }

    const formatted = this.formatMessage('VERBOSE', message, args);
    this.writeToStdout(chalk.cyan(formatted));
    this.writeToFile(formatted);
  }

  public trace(message: string, ...args: any[]): void {
    if (this.logLevel < LogLevel.TRACE) {
      return;
    }

    const formatted = this.formatMessage('TRACE', message, args);
    this.writeToStdout(chalk.cyan(formatted));
    this.writeToFile(formatted);
  }

  private formatMessage(level: string, message: string, args: any[]): string {
    const formattedMessage = format(message, ...args);
    const formattedLevel = level
      .toUpperCase()
      .padEnd(this.MAX_FORMATTED_LEVEL_LENGTH, ' ');

    return `${new Date().toISOString()} [${formattedLevel}] ${formattedMessage}`;
  }

  private writeToFile(message: string): void {
    if (this._logFile) {
      try {
        this._logFile.write(`${message}\n`);
      } catch (error) {
        // Silently handle write errors in tests
      }
    }
  }

  private writeToStdout(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  private writeToStderr(message: string): void {
    process.stderr.write(`${message}\n`);
  }
}

export const logger: Logger = new Logger();

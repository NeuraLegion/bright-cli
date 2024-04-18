import { Credentials } from './Credentials';
import { logger } from '../Utils';
import { Tokens } from './Tokens';
import { injectable } from 'tsyringe';
import { homedir } from 'node:os';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

@injectable()
export class FSTokens implements Tokens {
  private readonly baseDir: string = homedir();

  public writeTokens(credentials: Credentials): void {
    logger.debug('Saving tokens to file %s', this.path);

    writeFileSync(this.path, JSON.stringify(credentials));
  }

  public readTokens(): Credentials | undefined {
    let result: Credentials;
    for (const path of [this.path, this.legacyPath]) {
      logger.debug('Reading saved tokens from file %s', path);
      if (existsSync(path)) {
        logger.debug('File found. Return the tokens.');
        const resultRaw: Buffer = readFileSync(path);

        return JSON.parse(resultRaw.toString('utf8')) as Credentials;
      }
    }
    if (!result) {
      logger.debug("File doesn't exist.");
    }
  }

  private get path(): string {
    return join(this.baseDir, '.bright-cli');
  }

  /**
   * @deprecated `.nexploit-cli` path is deprecated, use .bright-cli. It's handled for backward compatibility.
   */
  private get legacyPath(): string {
    return join(this.baseDir, '.nexploit-cli');
  }
}

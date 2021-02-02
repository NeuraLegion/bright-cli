import { Credentials } from './Models';
import { logger } from '../Utils';
import { Tokens } from './Tokens';
import { injectable } from 'tsyringe';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

@injectable()
export class FSTokens implements Tokens {
  private readonly baseDir: string = homedir();

  public writeTokens(credentials: Credentials): void {
    logger.debug('Saving tokens to file %s', this.path);

    writeFileSync(this.path, JSON.stringify(credentials));
  }

  public readTokens(): Credentials | undefined {
    logger.debug('Reading saved tokens from file %s', this.path);

    if (existsSync(this.path)) {
      logger.debug('File found. Returns the tokens.');
      const result: Buffer = readFileSync(this.path);

      return JSON.parse(result.toString('utf8')) as Credentials;
    }

    logger.debug("File doesn't exist.");
  }

  private get path(): string {
    return join(this.baseDir, '.nexploit-cli');
  }
}

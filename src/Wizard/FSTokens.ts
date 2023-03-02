import { Credentials } from './Credentials';
import { logger } from '../Utils';
import { Tokens } from './Tokens';
import { injectable } from 'tsyringe';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * @deprecated .nexploit-cli path is deprecated, use .bright-cli.
 * Now it's handled for backward compatibility.
 */
const LEGACY_TOKENS_STORAGE_BASE_DIR = '.nexploit-cli';

const TOKENS_STORAGE_BASE_DIR = '.bright-cli';

@injectable()
export class FSTokens implements Tokens {
  private readonly baseDir: string = homedir();

  public writeTokens(credentials: Credentials): void {
    logger.debug('Saving tokens to file %s', this.path);

    writeFileSync(this.path, JSON.stringify(credentials));
  }

  public readTokens(): Credentials | undefined {
    logger.debug('Reading saved tokens from file %s', this.path);
    let result: Credentials;
    for (const path of this.paths) {
      if (existsSync(path)) {
        logger.debug('File found. Returns the tokens.');
        const resultRaw: Buffer = readFileSync(this.path);
        const fileResult = JSON.parse(
          resultRaw.toString('utf8')
        ) as Credentials;
        result = Object.assign(result ?? {}, fileResult);
      }
    }

    if (!result) {
      logger.debug("File doesn't exist.");
    }

    return result;
  }

  private get paths(): string[] {
    return [
      join(this.baseDir, LEGACY_TOKENS_STORAGE_BASE_DIR),
      join(this.baseDir, TOKENS_STORAGE_BASE_DIR)
    ];
  }

  private get path(): string {
    return join(this.baseDir, TOKENS_STORAGE_BASE_DIR);
  }
}

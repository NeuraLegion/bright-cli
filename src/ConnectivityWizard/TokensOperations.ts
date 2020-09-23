import { Tokens } from './Entities/Tokens';
import logger from '../Utils/Logger';
import os from 'os';
import fs from 'fs';
import path from 'path';

export class TokensOperations {
  public writeTokens(tokens: Tokens): void {
    const p: string = path.join(os.homedir(), '.nexploit_auth');
    logger.debug(`Saving tokens to file ${p}`);
    fs.writeFileSync(p, JSON.stringify(tokens));
  }

  public readTokens(): Tokens {
    const p: string = path.join(os.homedir(), '.nexploit_auth');
    logger.debug(`Reading saved tokens from file ${p}`);
    if (fs.existsSync(p)) {
      logger.debug('File found. Returns the value');
      const result: Buffer = fs.readFileSync(p);

      return <Tokens>(<unknown>JSON.parse(result.toString('utf8')));
    } else {
      logger.debug("File doesn't exist. Returning empty values");

      return {
        authToken: '',
        repeaterId: ''
      };
    }
  }
}

import { Credentials } from './Models';

export interface Tokens {
  writeTokens(credentials: Credentials): void;

  readTokens(): Credentials | undefined;
}

import { Credentials } from './Models/Credentials';

export interface Tokens {
  writeTokens(credentials: Credentials): void;

  readTokens(): Credentials | undefined;
}

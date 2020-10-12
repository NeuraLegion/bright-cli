import { Credentials } from './Entities/Credentials';

export interface Tokens {
  writeTokens(credentials: Credentials): void;

  readTokens(): Credentials | undefined;
}

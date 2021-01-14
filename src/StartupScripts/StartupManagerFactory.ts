import { StartupManager } from './StartupManager';

export interface StartupManagerFactory {
  create(options: {
    dispose?: () => Promise<unknown> | unknown;
  }): StartupManager;
}

export const StartupManagerFactory: unique symbol = Symbol(
  'StartupManagerFactory'
);

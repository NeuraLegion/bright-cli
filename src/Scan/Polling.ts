import { Breakpoint } from './Breakpoint';

export interface Polling {
  start(breakpoint: Breakpoint): Promise<void>;

  stop(): Promise<void>;
}

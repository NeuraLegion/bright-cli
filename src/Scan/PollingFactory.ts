import { Polling } from './Polling';
import { BreakpointType } from './BreakpointType';

export interface PollingConfig {
  timeout?: number;
  interval?: number;
  breakpoint: BreakpointType;
  scanId: string;
}

export interface PollingFactory {
  create(options: PollingConfig): Polling;
}

export const PollingFactory: unique symbol = Symbol('PollingFactory');

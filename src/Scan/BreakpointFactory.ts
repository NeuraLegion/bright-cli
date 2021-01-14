import { Breakpoint } from './Breakpoint';
import { BreakpointType } from './BreakpointType';

export interface BreakpointFactory {
  create(type: BreakpointType): Breakpoint;
}

export const BreakpointFactory: unique symbol = Symbol('BreakpointFactory');

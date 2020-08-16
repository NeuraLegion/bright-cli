import { Breakpoint } from './Breakpoint';
import { BreakpointType } from './BreakpointType';

export interface BreakpointFactory {
  create(type: BreakpointType): Breakpoint;
}

import { Breakpoint } from './Breakpoint';
import { OnSeverity } from './Breakpoints';
import { BreakpointFactory } from './BreakpointFactory';
import { BreakpointType } from './BreakpointType';
import { Severity } from './Severity';
import { injectable } from 'tsyringe';

@injectable()
export class DefaultBreakpointFactory implements BreakpointFactory {
  public create(type: BreakpointType): Breakpoint {
    switch (type) {
      case BreakpointType.ANY:
        return new OnSeverity(Severity.LOW);
      case BreakpointType.HIGH_ISSUE:
        return new OnSeverity(Severity.HIGH);
      case BreakpointType.MEDIUM_ISSUE:
        return new OnSeverity(Severity.MEDIUM);
      case BreakpointType.CRITICAL_ISSUE:
        return new OnSeverity(Severity.CRITICAL);
      default:
        return null;
    }
  }
}

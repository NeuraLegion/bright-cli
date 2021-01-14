import { Breakpoint } from './Breakpoint';
import { OnAny, OnSeverity } from './Breakpoints';
import { BreakpointFactory } from './BreakpointFactory';
import { BreakpointType } from './BreakpointType';
import { IssueCategory } from './Scans';
import { injectable } from 'tsyringe';

@injectable()
export class DefaultBreakpointFactory implements BreakpointFactory {
  public create(type: BreakpointType): Breakpoint {
    switch (type) {
      case BreakpointType.ANY:
        return new OnAny();
      case BreakpointType.HIGH_ISSUE:
        return new OnSeverity(IssueCategory.HIGH);
      case BreakpointType.MEDIUM_ISSUE:
        return new OnSeverity(IssueCategory.MEDIUM);
      default:
        return null;
    }
  }
}

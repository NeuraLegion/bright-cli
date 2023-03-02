import { Breakpoint } from '../Breakpoint';
import { BreakpointException } from './BreakpointException';
import { CountIssuesBySeverity } from '../Scans';

export class OnAny extends Breakpoint {
  constructor() {
    super();
  }

  protected breakOn(): never {
    throw new BreakpointException('Bright CLI found a first issue.');
  }

  protected selectCriterion(
    stats: CountIssuesBySeverity[]
  ): CountIssuesBySeverity | undefined {
    return stats.find((x: CountIssuesBySeverity) => !!x.number);
  }
}

import { Breakpoint } from '../Breakpoint';
import { BreakpointException } from './BreakpointException';
import { CountIssuesBySeverity, IssueCategory } from '../Scans';

export class OnSeverity extends Breakpoint {
  constructor(private readonly severity: IssueCategory) {
    super();
  }

  protected breakOn(): never {
    throw new BreakpointException(
      `NexPloit CLI found a first ${this.severity} issue.`
    );
  }

  protected selectCriterion(
    stats: CountIssuesBySeverity[]
  ): CountIssuesBySeverity | undefined {
    return stats.find((x: CountIssuesBySeverity) => x.type === this.severity);
  }
}

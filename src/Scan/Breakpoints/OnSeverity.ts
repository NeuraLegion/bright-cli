import { Breakpoint } from '../Breakpoint';
import { BreakpointException } from './BreakpointException';
import { ScanIssues } from '../Scans';
import { Severity, severityRanges } from '../Severity';

export class OnSeverity extends Breakpoint {
  private readonly breakSeverities: readonly Severity[];

  constructor(private readonly severity: Severity) {
    super();
    this.breakSeverities = severityRanges.get(severity) ?? [];
  }

  protected breakOn(): never {
    throw new BreakpointException(
      `Bright CLI found a first ${this.severity} issue.`
    );
  }

  protected isExcepted(stats: ScanIssues): boolean {
    return this.breakSeverities.some(
      (severity) => stats[`numberOf${severity}SeverityIssues`] > 0
    );
  }
}

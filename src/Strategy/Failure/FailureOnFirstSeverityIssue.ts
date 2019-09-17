import { IssueCategory, StatsIssuesCategory } from './Polling';
import { FailureStrategy } from './FailureStrategy';
import { FailureError } from './FailureError';

export class FailureOnFirstSeverityIssue extends FailureStrategy {
  private readonly severity: IssueCategory;

  constructor(severity: IssueCategory) {
    super();
    this.severity = severity;
  }

  protected exceptionOnFailure(stat: StatsIssuesCategory): never {
    throw new FailureError(`NexPloit found a first ${this.severity} issue.`);
  }

  protected isFailureCondition(stats: StatsIssuesCategory | null): boolean {
    return stats && stats.number > 0;
  }

  protected selectStatIssueCategory(
    issuesStats: StatsIssuesCategory[]
  ): StatsIssuesCategory {
    return issuesStats.find(
      (stats: StatsIssuesCategory) => stats.type === this.severity
    );
  }
}

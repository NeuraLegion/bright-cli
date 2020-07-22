import { IssueCategory, StatsIssuesCategory } from './Polling';
import { FailureStrategy } from './FailureStrategy';
import { FailureError } from './FailureError';

export class FailureOnFirstSeverityIssue extends FailureStrategy {
  constructor(private readonly severity: IssueCategory) {
    super();
  }

  protected exceptionOnFailure(): never {
    throw new FailureError(`NexPloit found a first ${this.severity} issue.`);
  }

  protected isFailureCondition(stats?: StatsIssuesCategory): boolean {
    return stats?.number > 0;
  }

  protected selectStatIssueCategory(
    issuesStats: StatsIssuesCategory[]
  ): StatsIssuesCategory {
    return issuesStats.find(
      (stats: StatsIssuesCategory) => stats.type === this.severity
    );
  }
}

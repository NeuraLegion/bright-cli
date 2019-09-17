import { StatsIssuesCategory } from './Polling';
import { FailureStrategy } from './FailureStrategy';
import { FailureError } from './FailureError';

export class FailureOnFirstIssue extends FailureStrategy {
  constructor() {
    super();
  }

  protected exceptionOnFailure(stat: StatsIssuesCategory): never {
    throw new FailureError(`NexPloit found a first issue.`);
  }

  protected isFailureCondition(stats: StatsIssuesCategory | null): boolean {
    return stats && stats.number > 0;
  }

  protected selectStatIssueCategory(
    issuesStats: StatsIssuesCategory[]
  ): StatsIssuesCategory {
    return issuesStats.find((stats: StatsIssuesCategory) => stats.number > 0);
  }
}

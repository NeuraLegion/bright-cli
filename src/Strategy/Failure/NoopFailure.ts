import { StatsIssuesCategory } from './Polling';
import { FailureStrategy } from './FailureStrategy';
import { FailureError } from './FailureError';

export class NoopFailure extends FailureStrategy {
  constructor() {
    super();
  }

  protected exceptionOnFailure(stat: StatsIssuesCategory): never {
    return null;
  }

  protected isFailureCondition(stats: StatsIssuesCategory | null): boolean {
    return false;
  }

  protected selectStatIssueCategory(
    issuesStats: StatsIssuesCategory[]
  ): StatsIssuesCategory {
    return null;
  }
}

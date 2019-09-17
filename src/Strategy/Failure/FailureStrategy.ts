import { StatsIssuesCategory } from './Polling';

export abstract class FailureStrategy {
  protected constructor() {}

  public async execute(
    statsIssuesCategories: StatsIssuesCategory[]
  ): Promise<void> {
    const stat: StatsIssuesCategory = this.selectStatIssueCategory(
      statsIssuesCategories
    );
    if (this.isFailureCondition(stat)) {
      this.exceptionOnFailure(stat);
    }
  }

  protected abstract exceptionOnFailure(
    stat: StatsIssuesCategory
  ): never | void;

  protected abstract isFailureCondition(
    stats: StatsIssuesCategory | null
  ): boolean;

  protected abstract selectStatIssueCategory(
    issuesStats: StatsIssuesCategory[]
  ): StatsIssuesCategory;
}

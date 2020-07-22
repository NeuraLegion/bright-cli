import { StatsIssuesCategory } from './Polling';

export abstract class FailureStrategy {
  protected abstract exceptionOnFailure(
    stat?: StatsIssuesCategory
  ): never | void;

  protected abstract isFailureCondition(stats?: StatsIssuesCategory): boolean;

  protected abstract selectStatIssueCategory(
    issuesStats: StatsIssuesCategory[]
  ): StatsIssuesCategory;

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
}

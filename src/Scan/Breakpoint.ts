import { CountIssuesBySeverity } from './Scans';

export abstract class Breakpoint {
  protected abstract breakOn(stat?: CountIssuesBySeverity): never | void;

  protected abstract selectCriterion(
    stats: CountIssuesBySeverity[]
  ): CountIssuesBySeverity | undefined;

  // eslint-disable-next-line @typescript-eslint/require-await
  public async execute(
    statsIssuesCategories: CountIssuesBySeverity[]
  ): Promise<void> {
    const stat: CountIssuesBySeverity | undefined = this.selectCriterion(
      statsIssuesCategories
    );

    if (this.isExcepted(stat)) {
      this.breakOn(stat);
    }
  }

  protected isExcepted(stats?: CountIssuesBySeverity): boolean {
    return !!stats?.number;
  }
}

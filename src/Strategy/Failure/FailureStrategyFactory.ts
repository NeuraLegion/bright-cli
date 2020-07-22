import { FailureStrategy } from './FailureStrategy';
import { FailureOnType, IssueCategory } from './Polling';
import { FailureOnFirstIssue } from './FailureOnFirstIssue';
import { FailureOnFirstSeverityIssue } from './FailureOnFirstSeverityIssue';

export class FailureStrategyFactory {
  public create(failureType: FailureOnType): FailureStrategy {
    switch (failureType) {
      case FailureOnType.FIRST_ISSUE:
        return new FailureOnFirstIssue();
      case FailureOnType.FIRST_HIGH_SEVERITY_ISSUE:
        return new FailureOnFirstSeverityIssue(IssueCategory.HIGH);
      case FailureOnType.FIRST_MEDIUM_SEVERITY_ISSUE:
        return new FailureOnFirstSeverityIssue(IssueCategory.MEDIUM);
      case FailureOnType.NONE:
      default:
        return null;
    }
  }
}

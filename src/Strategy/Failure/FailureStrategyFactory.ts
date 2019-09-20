import { FailureStrategy } from './FailureStrategy';
import { FailureOnType, IssueCategory } from './Polling';
import { FailureOnFirstIssue } from './FailureOnFirstIssue';
import { FailureOnFirstSeverityIssue } from './FailureOnFirstSeverityIssue';

export class FailureStrategyFactory {
  public Create(failureType: FailureOnType): FailureStrategy {
    switch (failureType) {
      case FailureOnType.firstIssue:
        return new FailureOnFirstIssue();
      case FailureOnType.firstHighSeverityIssue:
        return new FailureOnFirstSeverityIssue(IssueCategory.high);
      case FailureOnType.firstMediumSeverityIssue:
        return new FailureOnFirstSeverityIssue(IssueCategory.medium);
      case FailureOnType.none:
      default:
        return null;
    }
  }
}

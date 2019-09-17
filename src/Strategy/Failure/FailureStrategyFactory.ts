import { FailureStrategy } from './FailureStrategy';
import { FailureOnType, IssueCategory } from './Polling';
import { FailureOnFirstIssue } from './FailureOnFirstIssue';
import { FailureOnFirstSeverityIssue } from './FailureOnFirstSeverityIssue';

export class FailureStrategyFactory {
  private static _instance: FailureStrategyFactory;

  protected constructor() {}

  public static get Instance(): FailureStrategyFactory {
    if (!this._instance) {
      this._instance = new FailureStrategyFactory();
    }

    return this._instance;
  }

  public Create(failureType: FailureOnType): FailureStrategy {
    switch (failureType) {
      case FailureOnType.firstIssue:
        return new FailureOnFirstIssue();
      case FailureOnType.firstHighSeverityIssue:
        return new FailureOnFirstSeverityIssue(IssueCategory.high);
      case FailureOnType.firstMiddleSeverityIssue:
        return new FailureOnFirstSeverityIssue(IssueCategory.medium);
      case FailureOnType.none:
      default:
        return null;
    }
  }
}

export enum Severity {
  MEDIUM = 'Medium',
  HIGH = 'High',
  LOW = 'Low',
  CRITICAL = 'Critical'
}

export const severityRanges = new Map(
  Object.values(Severity).map((severity) => {
    switch (severity) {
      case Severity.CRITICAL:
        return [severity, [Severity.CRITICAL]];
      case Severity.HIGH:
        return [severity, [Severity.HIGH, Severity.CRITICAL]];
      case Severity.MEDIUM:
        return [severity, [Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL]];
      case Severity.LOW:
        return [severity, Object.values(Severity)];
    }
  })
);

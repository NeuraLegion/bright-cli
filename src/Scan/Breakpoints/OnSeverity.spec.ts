import { Severity } from '../Severity';
import { OnSeverity } from './OnSeverity';
import { ScanStatus } from '../Scans';
import { BreakpointException } from './BreakpointException';

const createCases = (severity: Severity, breaks: Severity[]) =>
  breaks.map((breakOn) => ({
    severity,
    breakOn
  }));

describe('OnSeverity', () => {
  const severityLowBreak = Object.values(Severity);
  const severityMediumBreak = [
    Severity.MEDIUM,
    Severity.HIGH,
    Severity.CRITICAL
  ];
  const severityHighBreak = [Severity.HIGH, Severity.CRITICAL];
  const severityCriticalBreak = [Severity.CRITICAL];

  describe('execute', () => {
    it.each([
      ...createCases(Severity.LOW, severityLowBreak),
      ...createCases(Severity.MEDIUM, severityMediumBreak),
      ...createCases(Severity.HIGH, severityHighBreak),
      ...createCases(Severity.CRITICAL, severityCriticalBreak)
    ])(
      'should throw BreakPointException when created for $severity and scan has $breakOn issue',
      async ({ severity, breakOn }) => {
        // arrange
        const onSeverity = new OnSeverity(severity);

        const scanIssues = {
          numberOfLowSeverityIssues: breakOn === Severity.LOW ? 1 : 0,
          numberOfMediumSeverityIssues: breakOn === Severity.MEDIUM ? 1 : 0,
          numberOfHighSeverityIssues: breakOn === Severity.HIGH ? 1 : 0,
          numberOfCriticalSeverityIssues: breakOn === Severity.CRITICAL ? 1 : 0
        };

        // act
        const act = onSeverity.execute({
          status: ScanStatus.RUNNING,
          ...scanIssues
        });

        // assert
        await expect(act).rejects.toThrow(BreakpointException);
      }
    );

    it.each([
      ...createCases(
        Severity.MEDIUM,
        Object.values(Severity).filter(
          (severity) => !severityMediumBreak.includes(severity)
        )
      ),
      ...createCases(
        Severity.HIGH,
        Object.values(Severity).filter(
          (severity) => !severityHighBreak.includes(severity)
        )
      ),
      ...createCases(
        Severity.CRITICAL,
        Object.values(Severity).filter(
          (severity) => !severityCriticalBreak.includes(severity)
        )
      )
    ])(
      'should do nothing when created for $severity and scan has $breakOn issue',
      async ({ severity, breakOn }) => {
        // arrange
        const onSeverity = new OnSeverity(severity);

        const scanIssues = {
          numberOfLowSeverityIssues: breakOn === Severity.LOW ? 1 : 0,
          numberOfMediumSeverityIssues: breakOn === Severity.MEDIUM ? 1 : 0,
          numberOfHighSeverityIssues: breakOn === Severity.HIGH ? 1 : 0,
          numberOfCriticalSeverityIssues: breakOn === Severity.CRITICAL ? 1 : 0
        };

        // act
        const result = await onSeverity.execute({
          status: ScanStatus.RUNNING,
          ...scanIssues
        });

        // assert
        expect(result).toBeUndefined();
      }
    );
  });
});

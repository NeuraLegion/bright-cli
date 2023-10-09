import { Severity, severityRanges } from '../Severity';
import { OnSeverity } from './OnSeverity';
import { ScanStatus } from '../Scans';
import { BreakpointException } from './BreakpointException';

const createCases = (severity: Severity, breaks: Severity[]) =>
  breaks.map((breakOn) => ({
    severity,
    scanIssues: {
      numberOfLowSeverityIssues: breakOn === Severity.LOW ? 1 : 0,
      numberOfMediumSeverityIssues: breakOn === Severity.MEDIUM ? 1 : 0,
      numberOfHighSeverityIssues: breakOn === Severity.HIGH ? 1 : 0,
      numberOfCriticalSeverityIssues: breakOn === Severity.CRITICAL ? 1 : 0
    }
  }));

describe('OnSeverity', () => {
  const severityLowBreak = severityRanges.get(Severity.LOW);
  const severityMediumBreak = severityRanges.get(Severity.MEDIUM);
  const severityHighBreak = severityRanges.get(Severity.HIGH);
  const severityCriticalBreak = severityRanges.get(Severity.CRITICAL);

  describe('execute', () => {
    it.each([
      ...createCases(Severity.LOW, severityLowBreak),
      ...createCases(Severity.MEDIUM, severityMediumBreak),
      ...createCases(Severity.HIGH, severityHighBreak),
      ...createCases(Severity.CRITICAL, severityCriticalBreak)
    ])(
      'should throw BreakPointException when created for $severity and scan has $breakOn issue',
      async ({ severity, scanIssues }) => {
        // arrange
        const onSeverity = new OnSeverity(severity);

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
      async ({ severity, scanIssues }) => {
        // arrange
        const onSeverity = new OnSeverity(severity);

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

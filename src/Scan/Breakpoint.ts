import { ScanState } from './Scans';

export abstract class Breakpoint {
  protected abstract breakOn(stat: ScanState): never | void;
  protected abstract isExcepted(stats: ScanState): boolean;

  // eslint-disable-next-line @typescript-eslint/require-await
  public async execute(scanIssues: ScanState): Promise<void> {
    if (this.isExcepted(scanIssues)) {
      this.breakOn(scanIssues);
    }
  }
}

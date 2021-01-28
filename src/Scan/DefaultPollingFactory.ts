import { PollingConfig, PollingFactory } from './PollingFactory';
import { Scans } from './Scans';
import { Polling } from './Polling';
import { BasePolling } from './BasePolling';
import { BreakpointFactory } from './BreakpointFactory';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DefaultPollingFactory implements PollingFactory {
  constructor(
    @inject(Scans) private readonly scans: Scans,
    @inject(BreakpointFactory)
    private readonly breakpointFactory: BreakpointFactory
  ) {}

  public create(options: PollingConfig): Polling {
    const breakpoint = this.breakpointFactory.create(options.breakpoint);

    return new BasePolling(options, this.scans, breakpoint);
  }
}

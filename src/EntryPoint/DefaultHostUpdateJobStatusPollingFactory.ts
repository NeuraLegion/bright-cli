import {
  HostUpdateJobStatusPollingConfig,
  HostUpdateJobStatusPollingFactory
} from './HostUpdateJobStatusPollingFactory';
import { Polling } from '../Utils/Polling';
import { HostUpdateJobStatusPolling } from './HostUpdateJobStatusPolling';
import { EntryPoints } from './EntryPoints';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DefaultHostUpdateJobStatusPollingFactory
  implements HostUpdateJobStatusPollingFactory
{
  constructor(
    @inject(EntryPoints)
    private readonly entryPoints: EntryPoints
  ) {}

  public create(options: HostUpdateJobStatusPollingConfig): Polling {
    return new HostUpdateJobStatusPolling(options, this.entryPoints);
  }
}

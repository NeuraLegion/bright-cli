import {
  DiscoveryPollingConfig,
  DiscoveryPollingFactory
} from './DiscoveryPollingFactory';
import { Polling } from '../Utils/Polling';
import { DiscoveryPolling } from './DiscoveryPolling';
import { Discoveries } from './Discoveries';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DefaultDiscoveryPollingFactory implements DiscoveryPollingFactory {
  constructor(
    @inject(Discoveries)
    private readonly discoveries: Discoveries
  ) {}

  public create(options: DiscoveryPollingConfig): Polling {
    return new DiscoveryPolling(options, this.discoveries);
  }
}

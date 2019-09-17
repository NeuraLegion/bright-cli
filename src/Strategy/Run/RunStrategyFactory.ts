import { RunStrategy } from './RunStrategy';
import { RunHarAndCrawlerDiscoveryStrategy } from './RunHarAndCrawlerDiscoveryStrategy';
import { RunHarDiscoveryStrategy } from './RunHarDiscoveryStrategy';
import { RunOasDiscoveryStrategy } from './RunOasDiscoveryStrategy';
import { RunCrawlerDiscoveryStrategy } from './RunCrawlerDiscoveryStrategy';
import { Discovery } from './RunStrategyExecutor';

export class RunStrategyFactory {
  public Create(
    discoveryTypes: ('crawler' | 'archive' | 'oas')[]
  ): RunStrategy {
    if (
      discoveryTypes.includes(Discovery.archive) &&
      discoveryTypes.includes(Discovery.crawler)
    ) {
      return new RunHarAndCrawlerDiscoveryStrategy();
    }

    if (discoveryTypes.includes(Discovery.archive)) {
      return new RunHarDiscoveryStrategy();
    }

    if (discoveryTypes.includes(Discovery.oas)) {
      return new RunOasDiscoveryStrategy();
    }

    if (discoveryTypes.includes(Discovery.crawler)) {
      return new RunCrawlerDiscoveryStrategy();
    }
  }
}

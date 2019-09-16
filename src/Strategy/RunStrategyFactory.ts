import { RunStrategy } from './RunStrategy';
import { RunHarAndCrawlerStrategy } from './RunHarAndCrawlerStrategy';
import { RunHarDiscoveryStrategy } from './RunHarDiscoveryStrategy';
import { RunOasDiscoveryStrategy } from './RunOasDiscoveryStrategy';
import { RunCrawlerDiscoveryStrategy } from './RunCrawlerDiscoveryStrategy';

export class RunStrategyFactory {
  public Create(
    discoveryTypes: ('crawler' | 'archive' | 'oas')[],
    baseUrl: string,
    apiKey: string
  ): RunStrategy {
    if (
      discoveryTypes.includes('archive') &&
      discoveryTypes.includes('crawler')
    ) {
      return new RunHarAndCrawlerStrategy(baseUrl, apiKey);
    }

    if (discoveryTypes.includes('archive')) {
      return new RunHarDiscoveryStrategy(baseUrl, apiKey);
    }

    if (discoveryTypes.includes('oas')) {
      return new RunOasDiscoveryStrategy(baseUrl, apiKey);
    }

    if (discoveryTypes.includes('crawler')) {
      return new RunCrawlerDiscoveryStrategy(baseUrl, apiKey);
    }
  }
}

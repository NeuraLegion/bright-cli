import { RunHarDiscoveryStrategy } from './RunHarDiscoveryStrategy';
import {
  Discovery,
  DiscoveryTypes,
  RunStrategyConfig,
  ScanConfig
} from './RunStrategyExecutor';
import { RequestPromiseAPI } from 'request-promise';

export class RunHarAndCrawlerDiscoveryStrategy extends RunHarDiscoveryStrategy {
  get discovery(): DiscoveryTypes {
    return [Discovery.crawler, Discovery.archive];
  }

  public async run(
    api: RequestPromiseAPI,
    config: RunStrategyConfig
  ): Promise<ScanConfig> {
    if (!Array.isArray(config.crawlerUrls) || config.crawlerUrls.length === 0) {
      throw new Error(`Config contains none of urls.`);
    }

    return super.run(api, config);
  }
}

import { RunStrategy } from './RunStrategy';
import {
  Discovery,
  DiscoveryTypes,
  RunStrategyConfig,
  ScanConfig
} from './RunStrategyExecutor';
import { RequestPromiseAPI } from 'request-promise';

export class RunCrawlerDiscoveryStrategy extends RunStrategy {
  get discovery(): DiscoveryTypes {
    return [Discovery.crawler];
  }

  public async run(
    api: RequestPromiseAPI,
    config: RunStrategyConfig
  ): Promise<ScanConfig> {
    const { filePath, fileDiscard, ...scanConfig } = config;

    if (
      !Array.isArray(scanConfig.crawlerUrls) ||
      scanConfig.crawlerUrls.length === 0
    ) {
      throw new Error(`Config contains none of urls.`);
    }
    return { ...scanConfig, discoveryTypes: this.discovery };
  }
}

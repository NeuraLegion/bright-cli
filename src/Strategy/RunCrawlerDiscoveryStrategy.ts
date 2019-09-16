import { RunStrategy, ScanConfig } from './RunStrategy';

export class RunCrawlerDiscoveryStrategy extends RunStrategy {
  constructor(baseUrl: string, apiKey: string) {
    super(baseUrl, apiKey);
  }

  public async run(config: ScanConfig): Promise<void> {
    if (!Array.isArray(config.crawlerUrls) || config.crawlerUrls.length === 0) {
      throw new Error(`Config doesn't contain none of urls.`);
    }
    await super.configureScan(config);
  }
}

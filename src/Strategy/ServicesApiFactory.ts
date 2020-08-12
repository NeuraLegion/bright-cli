import { Polling, PollingConfig } from './Failure';
import { ScanManager } from './ScanManager';
import { UploadStrategyFactory } from './UploadStrategyFactory';

export class ServicesApiFactory {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly proxyUrl?: string
  ) {}

  public createPolling(
    config: Omit<PollingConfig, 'apiKey' | 'baseUrl'>
  ): Polling {
    return new Polling({
      ...config,
      apiKey: this.apiKey,
      proxyUrl: this.proxyUrl,
      baseUrl: this.baseUrl
    });
  }

  public createScanManager(): ScanManager {
    return new ScanManager({
      baseUrl: this.baseUrl,
      proxyUrl: this.proxyUrl,
      apiKey: this.apiKey
    });
  }

  public createUploadStrategyFactory(): UploadStrategyFactory {
    return new UploadStrategyFactory(this.baseUrl, this.apiKey);
  }
}

import { Polling, PollingConfig } from './Failure';
import { ScanManager } from './ScanManager';
import { UploadStrategyFactory } from './UploadStrategyFactory';

export class ServicesApiFactory {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  public createPolling(config: PollingConfig): Polling {
    return new Polling(this.baseUrl, this.apiKey, config);
  }

  public createScanManager(): ScanManager {
    return new ScanManager(this.baseUrl, this.apiKey);
  }

  public createUploadStrategyFactory(): UploadStrategyFactory {
    return new UploadStrategyFactory(this.baseUrl, this.apiKey);
  }
}

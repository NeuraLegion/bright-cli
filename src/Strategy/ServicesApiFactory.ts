import { Polling, PollingConfig } from './Failure/Polling';
import { RunStrategyConfig, ScanManager } from './ScanManager';
import { UploadStrategyFactory } from './UploadStrategyFactory';

export class ServicesApiFactory {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  public CreatePolling(config: PollingConfig): Polling {
    return new Polling(this.baseUrl, this.apiKey, config);
  }

  public CreateScanManager(): ScanManager {
    return new ScanManager(this.baseUrl, this.apiKey);
  }

  public CreateUploadStrategyFactory(): UploadStrategyFactory {
    return new UploadStrategyFactory(this.baseUrl, this.apiKey);
  }
}

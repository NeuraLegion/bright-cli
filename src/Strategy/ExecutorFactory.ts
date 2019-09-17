import { Polling, PollingConfig } from './Failure/Polling';
import {
  RunStrategyConfig,
  RunStrategyExecutor
} from './Run/RunStrategyExecutor';

export class ExecutorFactory {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  public CreatePolling(config: PollingConfig): Polling {
    return new Polling(this.baseUrl, this.apiKey, config);
  }

  public CreateRunExecutor(config: RunStrategyConfig): RunStrategyExecutor {
    return new RunStrategyExecutor(this.baseUrl, this.apiKey, config);
  }
}

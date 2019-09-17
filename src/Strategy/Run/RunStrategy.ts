import {
  DiscoveryTypes,
  RunStrategyConfig,
  ScanConfig
} from './RunStrategyExecutor';
import { RequestPromiseAPI } from 'request-promise';

export abstract class RunStrategy {
  abstract get discovery(): DiscoveryTypes;

  public abstract run(
    api: RequestPromiseAPI,
    config: RunStrategyConfig
  ): Promise<ScanConfig | never>;
}

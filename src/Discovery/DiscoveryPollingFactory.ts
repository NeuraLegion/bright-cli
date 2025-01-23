import { Polling } from '../Utils/Polling';

export interface DiscoveryPollingConfig {
  timeout?: number;
  interval?: number;
  discoveryId: string;
  projectId: string;
}

export interface DiscoveryPollingFactory {
  create(options: DiscoveryPollingConfig): Polling;
}

export const DiscoveryPollingFactory: unique symbol = Symbol(
  'DiscoveryPollingFactory'
);

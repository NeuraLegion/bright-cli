import { ConnectivityStatus } from './ConnectivityStatus';

export interface IntegrationClient {
  ping(): Promise<ConnectivityStatus>;
}

export const IntegrationClient: unique symbol = Symbol('IntegrationClient');
import { Polling } from '../Utils/Polling';

export interface HostUpdateJobStatusPollingConfig {
  timeout?: number;
  interval?: number;
  jobId: string;
  projectId: string;
}

export interface HostUpdateJobStatusPollingFactory {
  create(options: HostUpdateJobStatusPollingConfig): Polling;
}

export const HostUpdateJobStatusPollingFactory: unique symbol = Symbol(
  'HostUpdateJobStatusPollingFactory'
);

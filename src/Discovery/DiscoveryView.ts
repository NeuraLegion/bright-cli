export interface DiscoveryView {
  id: string;
  name: string;
  status: DiscoveryStatus;
}

export enum DiscoveryStatus {
  RUNNING = 'running',
  PENDING = 'pending',
  STOPPED = 'stopped',
  FAILED = 'failed',
  DONE = 'done',
  DISRUPTED = 'disrupted',
  SCHEDULED = 'scheduled',
  QUEUED = 'queued'
}

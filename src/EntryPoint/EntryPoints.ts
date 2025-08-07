export interface EntryPointsListOptions {
  projectId: string;
  limit?: number;
  connectivity?: string[];
  status?: string[];
}

export interface UpdateHostOptions {
  projectId: string;
  oldHostname: string;
  newHostname: string;
  entryPointIds?: string[];
}

export interface GetHostUpdateJobStatusOptions {
  jobId: string;
  projectId: string;
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface HostUpdateJobStatusView {
  jobId: string;
  status: JobStatus;
  totalCount: number;
  processedCount: number;
  skippedCount: number;
  error?: string;
}

export interface EntryPoints {
  entrypoints(filter: EntryPointsListOptions): Promise<EntryPoint[]>;
  updateHost(options: UpdateHostOptions): Promise<{ taskId: string }>;
  getHostUpdateJobStatus(
    options: GetHostUpdateJobStatusOptions
  ): Promise<HostUpdateJobStatusView>;
}

export const EntryPoints: unique symbol = Symbol('EntryPoints');

export interface EntryPoint {
  id: string;
  method: string;
  url: string;
  responseStatus: number;
  connectivity: string;
  lastUpdated: string;
  lastEdited: string;
  lastValidated: string;
  parametersCount: number;
  responseTime: number;
  status: string;
  openIssuesCount: number;
  closedIssuesCount: number;
  createdAt: string;
}

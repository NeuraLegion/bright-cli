export interface EntryPointsListOptions {
  projectId: string;
  limit?: number;
  connectivity?: string[];
  status?: string[];
}

export interface ChangeHostOptions {
  projectId: string;
  newHost: string;
  oldHost?: string;
  entryPointIds?: string[];
}

export interface EntryPoints {
  entrypoints(filter: EntryPointsListOptions): Promise<EntryPoint[]>;
  changeHost(options: ChangeHostOptions): Promise<void>;
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

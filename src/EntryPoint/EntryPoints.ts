export interface EntryPointsListOptions {
  projectId: string;
  limit?: number;
  connectivity?: string[];
  status?: string[];
}

export interface EntryPoints {
  entrypoints(filter: EntryPointsListOptions): Promise<EntryPoint[]>;
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

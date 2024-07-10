export interface EntryPoints {
  entrypoints(projectId: string): Promise<EntryPoint[]>;
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

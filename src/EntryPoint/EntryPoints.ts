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

export interface GetEntryPointDetailsResponse {
  id: string;
  request: EntryPointDetailsRequest;
  connectivity: string;
  lastUpdated: string;
  parametersCount: number;
  responseTime: string;
  projectId: string;
  authObjectId: string;
  progress: number;
  duration: number;
}

type EntryPointDetailsRequest = {
  readonly url: string;
  readonly method: string;
};

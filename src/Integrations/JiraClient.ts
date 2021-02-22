import { ConnectivityStatus } from './ConnectivityStatus';
import { Ticket } from './Ticket';

export interface JiraApiOptions {
  readonly apiKey: string;
  readonly user: string;
  readonly baseUrl: string;
}

export const JiraApiOptions: unique symbol = Symbol('JiraApiOptions');

export interface IssueType {
  readonly name: 'Task';
}

export interface Project {
  readonly key: string;
}

export interface Fields {
  project?: Project;
  readonly summary: string;
  readonly description: string;
  readonly issuetype: IssueType;
}

export interface JiraProject {
  readonly self: string;
  readonly key: string;
  readonly name: string;
}

export interface JiraIssue extends Ticket {
  readonly fields: Fields;
}

export interface JiraClient {
  createIssue(issue: JiraIssue): Promise<void>;
  getProjects(): Promise<JiraProject[]>;
  getConnectivity(): Promise<ConnectivityStatus>;
}

export const JiraClient: symbol = Symbol.for('JiraClient');

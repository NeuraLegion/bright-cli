import { Project } from './Project';
import { Ticket } from './Ticket';

export interface IssueType {
  readonly name: 'Task';
}

export interface JiraProject extends Project {
  readonly self: string;
  readonly key: string;
  readonly name: string;
}

export interface Fields {
  readonly project: Omit<JiraProject, 'self' | 'name'>;
  readonly summary: string;
  readonly description: string;
  readonly issuetype: IssueType;
}

export interface JiraIssue extends Ticket {
  readonly fields: Fields;
}

import { bind, Handler } from '../Bus';
import { RegisterIssue } from './Events';
import { JiraClient, RequestJiraClientType } from '../Integrations';
import { inject, injectable } from 'tsyringe';

@injectable()
@bind(RegisterIssue)
export class RegisterIssueHandler implements Handler<RegisterIssue> {
  constructor(
    @inject(RequestJiraClientType) private readonly jiraClient: JiraClient
  ) {}

  public handle({ issue }: RegisterIssue): Promise<void> {
    return this.jiraClient.createIssue(issue);
  }
}

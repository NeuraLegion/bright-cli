import { bind, Handler } from '../Bus';
import { RegisterIssue } from './Events';
import { JiraClient } from '../Integrations';
import { inject, injectable } from 'tsyringe';

@injectable()
@bind(RegisterIssue)
export class RegisterIssueHandler implements Handler<RegisterIssue> {
  constructor(
    @inject(JiraClient) private readonly jiraClient: JiraClient
  ) {}

  public async handle({ issue }: RegisterIssue): Promise<void> {
    await this.jiraClient.createIssue(issue);
  }
}

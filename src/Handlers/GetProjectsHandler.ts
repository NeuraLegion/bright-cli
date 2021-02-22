import { bind, Handler } from '../Bus';
import { GetProjects } from './Events';
import { RequestJiraClientType, JiraClient, JiraProject } from '../Integrations';
import { inject, injectable } from 'tsyringe';

@injectable()
@bind(GetProjects)
export class GetProjectsHandler implements Handler<GetProjects, JiraProject[]> {
  constructor(
    @inject(RequestJiraClientType) private readonly jiraClient: JiraClient
  ) {}

  public handle(_event: GetProjects): Promise<JiraProject[]> {
    return this.jiraClient.getProjects();
  }
}

import { bind, Handler } from '../Bus';
import { GetProjects } from './Events';
import { JiraClient, JiraProject } from '../Integrations';
import { inject, injectable } from 'tsyringe';

@injectable()
@bind(GetProjects)
export class GetProjectsHandler implements Handler<GetProjects, JiraProject[]> {
  constructor(
    @inject(JiraClient) private readonly jiraClient: JiraClient
  ) {}

  public async handle(_event: GetProjects): Promise<JiraProject[]> {
    return this.jiraClient.getProjects();
  }
}

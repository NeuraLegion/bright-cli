import { bind, Handler } from '../Bus';
import { GetProjects } from './Events';
import { IntegrationClient, Project, Ticket } from '../Integrations';
import { injectable, injectAll } from 'tsyringe';

@injectable()
@bind(GetProjects)
export class GetProjectsHandler implements Handler<GetProjects, Project[]> {
  constructor(
    @injectAll(IntegrationClient) private readonly integrations: IntegrationClient<Ticket>[]
  ) {}

  public handle({ type }: GetProjects): Promise<Project[]> {
    const integration = this.integrations.find((x) => x.type === type);

    return integration.getProjects();
  }
}

import { bind, Handler } from '../Bus';
import { GetProjectsEvent } from './Events';
import { IntegrationClient, Project, Ticket } from '../Integrations';
import { injectable, injectAll } from 'tsyringe';

@injectable()
@bind(GetProjectsEvent)
export class GetProjectsHandler implements Handler<GetProjectsEvent, Project[]> {
  constructor(
    @injectAll(IntegrationClient) private readonly integrations: IntegrationClient<Ticket>[]
  ) {}

  public handle({ type }: GetProjectsEvent): Promise<Project[]> {
    const integration = this.integrations.find((x) => x.type === type);

    return integration.getProjects();
  }
}

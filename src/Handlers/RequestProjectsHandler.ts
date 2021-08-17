import { bind, Handler } from '../Bus';
import { RequestProjects } from './Events';
import { IntegrationClient, Project, Ticket } from '../Integrations';
import { injectable, injectAll } from 'tsyringe';

@injectable()
@bind(RequestProjects)
export class RequestProjectsHandler
  implements Handler<RequestProjects, Project[]>
{
  constructor(
    @injectAll(IntegrationClient)
    private readonly integrations: IntegrationClient<Ticket>[]
  ) {}

  public handle({ type }: RequestProjects): Promise<Project[]> {
    const integration = this.integrations.find((x) => x.type === type);

    if (!integration) {
      throw new Error(`Unsupported integration "${type}"`);
    }

    return integration.getProjects();
  }
}

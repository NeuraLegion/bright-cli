import { bind, Handler } from '../Bus';
import { RegisterIssueEvent } from './Events';
import { IntegrationClient, Ticket } from '../Integrations';
import { injectable, injectAll } from 'tsyringe';

@injectable()
@bind(RegisterIssueEvent)
export class RegisterIssueHandler implements Handler<RegisterIssueEvent> {
  constructor(
    @injectAll(IntegrationClient) private readonly integrations: IntegrationClient<Ticket>[]
  ) {}

  public handle({ issue, type }: RegisterIssueEvent): Promise<void> {
    const integration = this.integrations.find((x) => x.type === type);

    return integration.createTicket(issue);
  }
}

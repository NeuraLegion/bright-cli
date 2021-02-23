import { bind, Handler } from '../Bus';
import { RegisterIssue } from './Events';
import { IntegrationClient, Ticket } from '../Integrations';
import { injectable, injectAll } from 'tsyringe';

@injectable()
@bind(RegisterIssue)
export class RegisterIssueHandler implements Handler<RegisterIssue> {
  constructor(
    @injectAll(IntegrationClient) private readonly integrations: IntegrationClient<Ticket>[]
  ) {}

  public handle({ issue, type }: RegisterIssue): Promise<void> {
    const integration = this.integrations.find((x) => x.type === type);

    if (!integration) {
      throw new Error(`Unsupported integration "${type}"`);
    }

    return integration.createTicket(issue);
  }
}

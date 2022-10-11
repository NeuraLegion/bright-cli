import { JiraIssue, JiraProject } from './JiraClient';
import { ConnectivityStatus } from './ConnectivityStatus';
import { logger } from '../Utils';
import { IntegrationClient, TicketMetadata } from './IntegrationClient';
import { IntegrationType } from './IntegrationType';
import { IntegrationOptions } from './IntegrationOptions';
import request, { RequestPromiseAPI } from 'request-promise';
import { inject, injectable } from 'tsyringe';

@injectable()
export class JiraIntegrationClient implements IntegrationClient<JiraIssue> {
  private readonly client: RequestPromiseAPI;

  get type(): IntegrationType {
    return IntegrationType.JIRA;
  }

  constructor(
    @inject(IntegrationOptions) private readonly options: IntegrationOptions
  ) {
    this.client = request.defaults({
      json: true,
      rejectUnauthorized: !this.options.insecure,
      baseUrl: this.options.baseUrl,
      timeout: this.options.timeout,
      headers: {
        authorization: `Basic ${this.createToken(
          this.options.user,
          this.options.apiKey
        )}`
      }
    });
  }

  public async createTicket(issue: JiraIssue): Promise<TicketMetadata> {
    const { self } = await this.client.post({
      body: issue,
      uri: '/rest/api/2/issue'
    });

    return { url: self };
  }

  public async getProjects(): Promise<JiraProject[]> {
    const projects: JiraProject[] = await this.client.get({
      uri: '/rest/api/2/project'
    });

    return projects;
  }

  public async ping(): Promise<ConnectivityStatus> {
    try {
      await this.getProjects();

      return ConnectivityStatus.CONNECTED;
    } catch (err) {
      logger.error(`Failed connect to the Jira integration, %s`, err.message);

      return ConnectivityStatus.DISCONNECTED;
    }
  }

  private createToken(user: string, apiKey: string): string {
    return Buffer.from(`${user}:${apiKey}`).toString('base64');
  }
}

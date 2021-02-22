import { JiraApiOptions, JiraClient, JiraIssue, JiraProject } from './JiraClient';
import { ConnectivityStatus } from './ConnectivityStatus';
import { logger } from '../Utils';
import request, { RequestPromiseAPI } from 'request-promise';
import { inject, injectable } from 'tsyringe';

@injectable()
export class RequestJiraClient implements JiraClient {
  private readonly client: RequestPromiseAPI;

  constructor(
    @inject(JiraApiOptions) private readonly options: JiraApiOptions,
  ) {
    this.client = request.defaults({
      baseUrl: this.options.baseUrl,
      json: true,
      headers: { authorization: `Basic ${this.createToken(this.options.user, this.options.apiKey)}` }
    });
  }

  public async createIssue(issue: JiraIssue): Promise<void> {
    await this.client.post({
      body: issue,
      uri: '/rest/api/2/issue',
    });
  }

  public async getProjects(): Promise<JiraProject[]> {
    const response: JiraProject[] = await this.client.get({
      uri: '/rest/api/2/project',
    });

    return response;
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

export const RequestJiraClientType: unique symbol = Symbol('RequestJiraClient');

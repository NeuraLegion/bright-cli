import { JiraApiOptions, JiraClient, JiraIssue, JiraProject } from './JiraClient';
import { ConnectivityStatus } from './ConnectivityStatus';
import { logger } from '../Utils';
import axios from 'axios';
import { inject, injectable } from 'tsyringe';

@injectable()
export class AxiosJiraClient implements JiraClient {
  constructor(
    @inject(JiraApiOptions) private readonly options: JiraApiOptions,
  ) {}

  public async createIssue(issue: JiraIssue): Promise<void> {
    const { baseUrl, user, apiKey } = this.options;

    await axios.post('/rest/api/2/issue', issue, {
      baseURL: baseUrl,
      headers: {
        authorization: `Basic ${this.getToken(user, apiKey)}`
      }
    });
  }

  public async getProjects(): Promise<JiraProject[]> {
    const { baseUrl, user, apiKey } = this.options;

    const response: { data: JiraProject[] } = await axios.get(
      '/rest/api/2/project',
      {
        baseURL: baseUrl,
        headers: {
          authorization: `Basic ${this.getToken(user, apiKey)}`
        }
      }
    );

    return response.data;
  }

  public async getConnectivity(): Promise<ConnectivityStatus> {
    try {
      await this.getProjects();
    } catch (err) {
      logger.error(`Failed connect to the Jira integration, ${err.message}`);

      return ConnectivityStatus.DISCONNECTED;
    }

    return ConnectivityStatus.CONNECTED;
  }

  private getToken(user: string, apiKey: string): string {
    return Buffer.from(`${user}:${apiKey}`).toString('base64');
  }
}

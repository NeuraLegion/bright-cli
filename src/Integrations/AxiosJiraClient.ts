import { JiraApiOptions, JiraClient, JiraIssue, JiraProject } from './JiraClient';
import { ConnectivityStatus } from './ConnectivityStatus';
import axios from 'axios';
import { inject, injectable } from 'tsyringe';

@injectable()
export class AxiosJiraClient implements JiraClient {
  constructor(
    @inject(JiraApiOptions) private readonly options: JiraApiOptions,
  ) {}

  public async createIssue(issue: JiraIssue): Promise<void> {
    const projects = await this.getProjects();

    await Promise.all(projects.map(({ key }: JiraProject) => this.createTicket({
        ...issue,
        fields: {
          ...issue.fields,
          project: { key }
        }
    })));
  }

  public async getConnectivity(): Promise<ConnectivityStatus> {
    try {
      await this.getProjects();
    } catch (err) {
      return ConnectivityStatus.DISCONNECTED;
    }

    return ConnectivityStatus.CONNECTED;
  }

  private async getProjects(): Promise<JiraProject[]> {
    const { baseUrl, user, apiKey } = this.options;

    const response: { data: JiraProject[] } = await axios.get(
      '/rest/api/2/project',
      {
        baseURL: baseUrl,
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Authorization: `Basic ${this.getToken(user, apiKey)}`
        }
      }
    );

    return response.data;
  }

  private async createTicket(ticket: JiraIssue) {
    const { baseUrl, user, apiKey } = this.options;

    await axios.post('/rest/api/2/issue', ticket, {
      baseURL: baseUrl,
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Authorization: `Basic ${this.getToken(user, apiKey)}`
      }
    });
  }

  private getToken(user: string, apiKey: string): string {
    return Buffer.from(`${user}:${apiKey}`).toString('base64');
  }
}

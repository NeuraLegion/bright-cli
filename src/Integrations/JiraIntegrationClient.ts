import { JiraIssue, JiraProject } from './JiraClient';
import { ConnectivityStatus } from './ConnectivityStatus';
import { logger, ProxyFactory } from '../Utils';
import { IntegrationClient } from './IntegrationClient';
import { IntegrationType } from './IntegrationType';
import { IntegrationOptions } from './IntegrationOptions';
import { inject, injectable } from 'tsyringe';
import axios, { Axios } from 'axios';
import http from 'http';
import https from 'https';

@injectable()
export class JiraIntegrationClient implements IntegrationClient<JiraIssue> {
  private readonly client: Axios;

  get type(): IntegrationType {
    return IntegrationType.JIRA;
  }

  constructor(
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(IntegrationOptions) private readonly options: IntegrationOptions
  ) {
    const {
      httpAgent = new http.Agent(),
      httpsAgent = new https.Agent({
        rejectUnauthorized: !this.options.insecure
      })
    } = this.options.proxyUrl
      ? this.proxyFactory.createProxy({
          proxyUrl: this.options.proxyUrl,
          rejectUnauthorized: !this.options.insecure
        })
      : {};

    this.client = axios.create({
      httpAgent,
      httpsAgent,
      baseURL: this.options.baseUrl,
      timeout: this.options.timeout,
      responseType: 'json',
      headers: {
        authorization: `Basic ${this.createToken(
          this.options.user,
          this.options.apiKey
        )}`
      }
    });
  }

  public async createTicket(issue: JiraIssue): Promise<void> {
    await this.client.post('/rest/api/2/issue', issue);
  }

  public async getProjects(): Promise<JiraProject[]> {
    const res = await this.client.get<JiraProject[]>('/rest/api/2/project');

    return res.data;
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

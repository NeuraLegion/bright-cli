import 'reflect-metadata';
import { JiraIntegrationClient } from './JiraIntegrationClient';
import { IntegrationOptions } from './IntegrationOptions';
import { ProxyFactory } from '../Utils';
import { JiraIssue } from './JiraClient';
import { ConnectivityStatus } from './ConnectivityStatus';
import { instance, mock, reset } from 'ts-mockito';
import nock from 'nock';

describe('JiraIntegrationClient', () => {
  const proxyFactoryMock = mock<ProxyFactory>();
  const integrationOptions: IntegrationOptions = {
    timeout: 10000,
    apiKey: 'testKey',
    user: 'testUser',
    baseUrl: 'http://example.com'
  };

  let jiraIntegrationClient!: JiraIntegrationClient;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  beforeEach(() => {
    if (!nock.isActive()) {
      nock.activate();
    }

    jiraIntegrationClient = new JiraIntegrationClient(
      instance(proxyFactoryMock),
      integrationOptions
    );
  });

  afterEach(() => {
    reset(proxyFactoryMock);
    nock.cleanAll();
    nock.restore();
  });

  afterAll(() => nock.enableNetConnect());

  describe('createTicket', () => {
    it('should create a ticket', async () => {
      const issue = { fields: { summary: 'Test issue' } } as JiraIssue;

      nock(integrationOptions.baseUrl)
        .post('/rest/api/2/issue', JSON.stringify(issue))
        .reply(
          200,
          {},
          {
            'content-type': 'application/json'
          }
        );

      await jiraIntegrationClient.createTicket(issue);

      expect(nock.isDone()).toBeTruthy();
    });
  });

  describe('getProjects', () => {
    it('should return a list of projects', async () => {
      const projects = [{ id: '1', name: 'Test project' }];

      nock(integrationOptions.baseUrl)
        .get('/rest/api/2/project')
        .reply(200, projects, {
          'content-type': 'application/json'
        });

      const result = await jiraIntegrationClient.getProjects();

      expect(result).toEqual(projects);
    });
  });

  describe('ping', () => {
    it(`should return ${ConnectivityStatus.CONNECTED} if the ping is successful`, async () => {
      nock(integrationOptions.baseUrl)
        .get('/rest/api/2/project')
        .reply(200, [], {
          'content-type': 'application/json'
        });

      const result = await jiraIntegrationClient.ping();

      expect(result).toBe(ConnectivityStatus.CONNECTED);
    });

    it(`should return ${ConnectivityStatus.DISCONNECTED} if the ping fails`, async () => {
      nock(integrationOptions.baseUrl)
        .get('/rest/api/2/project')
        .replyWithError('Test error');

      const result = await jiraIntegrationClient.ping();

      expect(result).toBe(ConnectivityStatus.DISCONNECTED);
    });
  });
});

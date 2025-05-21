import {
  EntryPoints,
  EntryPoint,
  EntryPointsListOptions,
  GetHostUpdateJobStatusOptions,
  HostUpdateJobStatusView,
  UpdateHostOptions
} from './EntryPoints';
import { ProxyFactory } from '../Utils';
import axios, { Axios } from 'axios';
import { inject, injectable } from 'tsyringe';
import http from 'node:http';
import https from 'node:https';

export interface RestProjectsOptions {
  baseURL: string;
  apiKey: string;
  timeout?: number;
  insecure?: boolean;
  proxyURL?: string;
  proxyDomains?: string[];
}

export const RestProjectsOptions: unique symbol = Symbol('RestProjectsOptions');

@injectable()
export class RestEntryPoints implements EntryPoints {
  private readonly entrypointsPaginationBatchSize = 50;
  private readonly client: Axios;

  constructor(
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(RestProjectsOptions)
    { baseURL, apiKey, insecure, proxyURL, timeout }: RestProjectsOptions
  ) {
    const {
      httpAgent = new http.Agent(),
      httpsAgent = new https.Agent({ rejectUnauthorized: !insecure })
    } = proxyURL
      ? this.proxyFactory.createProxy({
          proxyUrl: proxyURL,
          rejectUnauthorized: !insecure
        })
      : {};

    this.client = axios.create({
      baseURL,
      timeout,
      httpAgent,
      httpsAgent,
      responseType: 'json',
      headers: { authorization: `Api-Key ${apiKey}` }
    });
  }

  public async entrypoints({
    limit = 10,
    projectId,
    ...filters
  }: EntryPointsListOptions): Promise<EntryPoint[]> {
    let remaining = limit;
    const data: EntryPoint[] = [];
    let nextId: string;
    let nextCreatedAt: string;

    while (remaining > 0) {
      const {
        data: { items = [] }
      } = await this.client.get(`/api/v2/projects/${projectId}/entry-points`, {
        params: {
          nextId,
          nextCreatedAt,
          ...filters,
          limit: Math.min(remaining, this.entrypointsPaginationBatchSize)
        }
      });

      if (!items.length) {
        break;
      }

      data.push(...items);
      ({ id: nextId, createdAt: nextCreatedAt } = items[items.length - 1]);

      remaining -= this.entrypointsPaginationBatchSize;
    }

    return data;
  }

  public async updateHost(
    options: UpdateHostOptions
  ): Promise<{ taskId: string }> {
    const { projectId, oldHostname, newHostname, entryPointIds } = options;

    const { data } = await this.client.post<{ taskId: string }>(
      `/api/v2/projects/${projectId}/entry-points/update-host`,
      {
        oldHostname,
        newHostname,
        entryPointIds
      }
    );

    return data;
  }

  public async getHostUpdateJobStatus(
    options: GetHostUpdateJobStatusOptions
  ): Promise<HostUpdateJobStatusView> {
    const { jobId, projectId } = options;

    const { data } = await this.client.get<HostUpdateJobStatusView>(
      `/api/v2/projects/${projectId}/entry-points/update-host/${jobId}`
    );

    return data;
  }
}

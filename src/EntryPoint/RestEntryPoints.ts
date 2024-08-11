import {
  EntryPoints,
  EntryPoint,
  GetEntryPointDetailsResponse
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
  private readonly client: Axios;

  constructor(
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(RestProjectsOptions)
    {
      baseURL,
      apiKey,
      insecure,
      proxyURL,
      timeout = 10000
    }: RestProjectsOptions
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

  public async entrypoints(projectId: string): Promise<EntryPoint[]> {
    const res = await this.client.get(
      `/api/v2/projects/${projectId}/entry-points`
    );

    return res.data.items;
  }

  public async getEntryPointDetails(
    projectId: string,
    entryPointId: string
  ): Promise<GetEntryPointDetailsResponse> {
    try {
      const res = await this.client.get<GetEntryPointDetailsResponse>(
        `api/v2/projects/${projectId}/entry-points/${entryPointId}`
      );

      return res.data;
    } catch (_) {
      return undefined;
    }
  }
}

import { EntryPoints, EntryPoint } from './EntryPoints';
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

  public async entrypoints(
    projectId: string,
    limit: number = 10
  ): Promise<EntryPoint[]> {
    let remaining = limit;
    const batchSize = 50;
    const data: EntryPoint[] = [];
    let nextId: string;
    let nextCreatedAt: string;

    while (l > 0) {
      const res = await this.client.get(
        `/api/v2/projects/${projectId}/entry-points`,
        {
          params: {
            nextId,
            nextCreatedAt,
            limit: Math.min(l, batchSize)
          }
        }
      );

      if (!res.data.items || res.data.items.length === 0) {
        break;
      }

      data.push(...res.data.items);
      ({ id: nextId, createdAt: nextCreatedAt } = items[items.length - 1]);

      l -= batchSize;
    }

    return data;
  }
}

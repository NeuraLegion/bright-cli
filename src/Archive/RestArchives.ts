import { Archives, Spec, SpecType } from './Archives';
import { ProxyFactory } from '../Utils';
import { inject, injectable } from 'tsyringe';
import axios, { Axios } from 'axios';
import FormData from 'form-data';
import { ok } from 'assert';
import https from 'https';
import http from 'http';

export interface RestArchivesOptions {
  insecure?: boolean;
  timeout?: number;
  baseURL: string;
  apiKey: string;
  proxyURL?: string;
}

export const RestArchivesOptions: unique symbol = Symbol('RestArchivesOptions');

@injectable()
export class RestArchives implements Archives {
  private readonly client: Axios;
  private readonly ALLOWED_SPECS: readonly SpecType[] = [
    SpecType.OPENAPI,
    SpecType.POSTMAN,
    SpecType.HAR
  ];

  constructor(
    @inject(ProxyFactory) private readonly proxyFactory: ProxyFactory,
    @inject(RestArchivesOptions)
    {
      baseURL,
      apiKey,
      proxyURL,
      insecure,
      timeout = 10000
    }: RestArchivesOptions
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

  public async upload(spec: Spec): Promise<string> {
    ok(
      this.ALLOWED_SPECS.includes(spec.type),
      `Invalid specification type. Allowed: ${this.ALLOWED_SPECS}`
    );

    const { discard, headers, variables, projectId } = spec;
    const file = this.castToFile(spec);

    const formData = new FormData();
    formData.append('file', file.value, file.options);
    formData.append('projectId', projectId);
    formData.append('headers', JSON.stringify(headers ?? {}));
    formData.append('variables', JSON.stringify(variables ?? {}));
    const res = await this.client.post<{ id: string }>(
      '/api/v1/files',
      formData,
      {
        params: { discard }
      }
    );

    return res.data.id;
  }

  private castToFile({
    filename,
    content,
    contentType = 'application/json'
  }: Spec): {
    options: { filename: string; contentType: string };
    value: Buffer;
  } {
    return {
      options: {
        filename,
        contentType
      },
      value: Buffer.from(content)
    };
  }
}

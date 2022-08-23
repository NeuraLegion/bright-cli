import { Archives, Spec, SpecType } from './Archives';
import request, { RequestPromiseAPI } from 'request-promise';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { inject, injectable } from 'tsyringe';
import { ok } from 'assert';

export interface RestArchivesOptions {
  insecure?: boolean;
  timeout?: number;
  baseUrl: string;
  apiKey: string;
  proxyUrl?: string;
}

export const RestArchivesOptions: unique symbol = Symbol('RestArchivesOptions');

@injectable()
export class RestArchives implements Archives {
  private readonly client: RequestPromiseAPI;
  private readonly ALLOWED_SPECS: readonly SpecType[] = [
    SpecType.OPENAPI,
    SpecType.POSTMAN,
    SpecType.HAR
  ];

  constructor(
    @inject(RestArchivesOptions)
    {
      baseUrl,
      apiKey,
      proxyUrl,
      insecure,
      timeout = 10000
    }: RestArchivesOptions
  ) {
    this.client = request.defaults({
      baseUrl,
      timeout,
      json: true,
      rejectUnauthorized: !insecure,
      agent: proxyUrl ? new SocksProxyAgent(proxyUrl) : undefined,
      headers: { authorization: `Api-Key ${apiKey}` }
    });
  }

  public async upload(spec: Spec): Promise<string> {
    ok(
      this.ALLOWED_SPECS.includes(spec.type),
      `Invalid specification type. Allowed: ${this.ALLOWED_SPECS}`
    );

    const { discard, headers, variables } = spec;
    const file = this.castToFile(spec);

    const { id }: { id: string } = await this.client.post({
      uri: `/api/v1/files`,
      qs: { discard },
      formData: {
        file,
        headers: JSON.stringify(headers ?? {}),
        variables: JSON.stringify(variables ?? {})
      }
    });

    return id;
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

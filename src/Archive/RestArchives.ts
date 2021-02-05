import { Archives, Spec, SpecType } from './Archives';
import request, { RequestPromiseAPI } from 'request-promise';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { inject, injectable } from 'tsyringe';
import { ok } from 'assert';

export interface RestArchivesOptions {
  timeout?: number;
  baseUrl: string;
  apiKey: string;
  proxyUrl?: string;
}

export const RestArchivesOptions: unique symbol = Symbol('RestArchivesOptions');

@injectable()
export class RestArchives implements Archives {
  private readonly client: RequestPromiseAPI;

  constructor(
    @inject(RestArchivesOptions)
    { baseUrl, apiKey, proxyUrl, timeout = 10000 }: RestArchivesOptions
  ) {
    this.client = request.defaults({
      baseUrl,
      timeout,
      json: true,
      agent: proxyUrl ? new SocksProxyAgent(proxyUrl) : undefined,
      headers: { authorization: `Api-Key ${apiKey}` }
    });
  }

  public async upload(spec: Spec): Promise<string> {
    ok(
      spec.type === SpecType.HAR,
      `Invalid specification type. Allowed: ${SpecType.HAR}`
    );
    const file = this.castToFile(spec);

    const { discard } = spec;

    const files: { id: string }[] = await this.client.post({
      uri: `/api/v1/files`,
      qs: { discard },
      formData: {
        file
      }
    });

    return files[0]?.id;
  }

  public async convertAndUpload(spec: Spec): Promise<string> {
    const allowedSpec = [SpecType.OPENAPI, SpecType.POSTMAN];
    ok(
      allowedSpec.includes(spec.type),
      `Invalid specification type. Allowed: ${allowedSpec}`
    );

    const file = this.castToFile(spec);

    const { type, discard, headers, variables } = spec;

    const { id }: { id: string } = await this.client.post({
      uri: `/api/v1/specs`,
      qs: { discard },
      formData: {
        file,
        spec: type,
        headers: JSON.stringify(headers ?? {}),
        variables: JSON.stringify(variables ?? {})
      }
    });

    return id;
  }

  private castToFile({ filename, content }: Spec) {
    const options: { filename: string; contentType: string } = {
      filename,
      contentType: 'application/json'
    };
    const file: {
      options: { filename: string; contentType: string };
      value: Buffer;
    } = {
      options,
      value: Buffer.from(content)
    };

    return file;
  }
}

import { Discovery } from '../ScanManager';
import { Parser } from '../../Parsers';
import { Headers } from 'request';
import request from 'request-promise';
import { RequestPromiseAPI } from 'request-promise';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { basename } from 'path';

export interface File {
  value: Buffer;
  options: { filename: string; contentType: string };
}

export interface UploadStrategyOptions<T> {
  baseUrl: string;
  apiKey: string;
  fileParser: Parser<string, T>;
  proxyUrl?: string;
}

export abstract class UploadStrategy<T> {
  protected readonly client: RequestPromiseAPI;
  private readonly fileParser: Parser<string, T>;

  abstract get discovery(): Discovery;

  protected constructor({
    baseUrl,
    apiKey,
    proxyUrl,
    fileParser
  }: UploadStrategyOptions<T>) {
    this.fileParser = fileParser;
    this.client = request.defaults({
      baseUrl,
      agent: proxyUrl ? new SocksProxyAgent(proxyUrl) : undefined,
      headers: { authorization: `Api-Key ${apiKey}` }
    });
  }

  protected abstract sendRequestToService(
    file: File,
    discard: boolean,
    headers?: Headers
  ): Promise<string | never>;

  public async upload(config: {
    path: string;
    discard: boolean;
    headers?: Headers;
  }): Promise<string | never> {
    const file: File = await this.getRequestOptions(config.path);

    return this.sendRequestToService(file, config.discard, config.headers);
  }

  protected async getRequestOptions(filePath: string): Promise<File | never> {
    const value: T = await this.fileParser.parse(filePath);

    return {
      value: Buffer.from(JSON.stringify(value)),
      options: {
        contentType: 'application/json',
        filename: basename(filePath)
      }
    };
  }
}

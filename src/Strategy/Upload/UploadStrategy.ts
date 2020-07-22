import { Discovery } from '../ScanManager';
import { Parser } from '../../Parsers';
import { Headers } from 'request';
import * as request from 'request-promise';
import { RequestPromiseAPI } from 'request-promise';
import { basename } from 'path';

export interface File {
  value: Buffer;
  options: { filename: string; contentType: string };
}

export abstract class UploadStrategy<T> {
  protected readonly proxy: RequestPromiseAPI;
  private readonly proxyConfig: {
    strictSSL: boolean;
    headers: { Authorization: string };
    baseUrl: string;
  };
  private readonly fileParser: Parser<string, T>;

  protected constructor(
    baseUrl: string,
    apiKey: string,
    fileParser: Parser<string, T>
  ) {
    this.proxyConfig = {
      baseUrl,
      strictSSL: false,
      headers: { Authorization: `Api-Key ${apiKey}` }
    };
    this.fileParser = fileParser;
    this.proxy = request.defaults(this.proxyConfig);
  }

  abstract get discovery(): Discovery;

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

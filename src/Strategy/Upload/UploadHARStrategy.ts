import { Headers } from 'request';
import { File, UploadStrategy } from './UploadStrategy';
import { Har } from 'har-format';
import { Discovery } from '../ScanManager';
import { Parser } from '../../Parsers/Parser';

export class UploadHARStrategy extends UploadStrategy<Har> {
  constructor(
    baseUrl: string,
    apiKey: string,
    fileParser: Parser<string, Har>
  ) {
    super(baseUrl, apiKey, fileParser);
  }

  get discovery(): Discovery {
    return Discovery.archive;
  }

  protected async sendRequestToService(
    file: File,
    discard: boolean,
    headers?: Headers
  ): Promise<string> {
    const { ids }: { ids?: string[] } = await this.proxy.post({
      uri: `/api/v1/files`,
      qs: { discard },
      json: true,
      formData: {
        file
      }
    });

    return ids[0];
  }
}

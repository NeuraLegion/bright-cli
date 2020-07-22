import { File, UploadStrategy } from './UploadStrategy';
import { Discovery } from '../ScanManager';
import { Parser } from '../../Parsers';
import { Har } from 'har-format';

export class UploadHARStrategy extends UploadStrategy<Har> {
  constructor(
    baseUrl: string,
    apiKey: string,
    fileParser: Parser<string, Har>
  ) {
    super(baseUrl, apiKey, fileParser);
  }

  get discovery(): Discovery {
    return Discovery.ARCHIVE;
  }

  protected async sendRequestToService(
    file: File,
    discard: boolean
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

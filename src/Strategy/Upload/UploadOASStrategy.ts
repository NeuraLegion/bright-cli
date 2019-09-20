import { Headers } from 'request';
import { File, UploadStrategy } from './UploadStrategy';
import { Discovery } from '../ScanManager';
import { Parser } from '../../Parsers/Parser';

export class UploadOASStrategy extends UploadStrategy<any> {
  constructor(
    baseUrl: string,
    apiKey: string,
    fileParser: Parser<string, any>
  ) {
    super(baseUrl, apiKey, fileParser);
  }

  get discovery(): Discovery {
    return Discovery.oas;
  }

  protected async sendRequestToService(
    file: File,
    discard: boolean,
    headers?: Headers
  ): Promise<string> {
    const { id }: { id?: string } = await this.proxy.post({
      uri: `/api/v1/specs`,
      qs: { discard },
      json: true,
      formData: {
        file,
        spec: 'OpenAPI',
        headers: headers && JSON.stringify(headers)
      }
    });

    return id;
  }
}

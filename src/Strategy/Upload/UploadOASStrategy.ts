import { File, UploadStrategy } from './UploadStrategy';
import { Discovery } from '../ScanManager';
import { Parser } from '../../Parsers';
import { Headers } from 'request';

export class UploadOASStrategy extends UploadStrategy<any> {
  constructor(baseUrl: string, apiKey: string, fileParser: Parser<string>) {
    super(baseUrl, apiKey, fileParser);
  }

  get discovery(): Discovery {
    return Discovery.OAS;
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

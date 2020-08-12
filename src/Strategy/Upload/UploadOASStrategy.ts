import { File, UploadStrategy, UploadStrategyOptions } from './UploadStrategy';
import { Discovery } from '../ScanManager';
import { Headers } from 'request';

export class UploadOASStrategy extends UploadStrategy<any> {
  get discovery(): Discovery {
    return Discovery.OAS;
  }

  constructor(options: UploadStrategyOptions<any>) {
    super(options);
  }

  protected async sendRequestToService(
    file: File,
    discard: boolean,
    headers?: Headers
  ): Promise<string> {
    const { id }: { id?: string } = await this.client.post({
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

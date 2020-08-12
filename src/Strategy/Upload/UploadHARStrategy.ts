import { File, UploadStrategy, UploadStrategyOptions } from './UploadStrategy';
import { Discovery } from '../ScanManager';
import { Har } from 'har-format';

export class UploadHARStrategy extends UploadStrategy<Har> {
  get discovery(): Discovery {
    return Discovery.ARCHIVE;
  }

  constructor(options: UploadStrategyOptions<Har>) {
    super(options);
  }

  protected async sendRequestToService(
    file: File,
    discard: boolean
  ): Promise<string> {
    const { ids }: { ids?: string[] } = await this.client.post({
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

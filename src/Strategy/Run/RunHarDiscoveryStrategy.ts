import { RunArchiveDiscoveryStrategy } from './RunArchiveDiscoveryStrategy';
import { HarFileParser } from '../../Parsers/HarFileParser';
import { createReadStream } from 'fs';
import { Discovery, DiscoveryTypes } from './RunStrategyExecutor';
import { Options as RequestOptions } from 'request';

export class RunHarDiscoveryStrategy extends RunArchiveDiscoveryStrategy {
  get discovery(): DiscoveryTypes {
    return [Discovery.archive];
  }

  protected getUploadArchiveOptions(
    filePath: string,
    discard: boolean = true
  ): RequestOptions {
    return {
      uri: `/files`,
      qs: { discard },
      json: true,
      formData: {
        file: createReadStream(filePath)
      }
    };
  }

  protected async validateFile(filePath: string): Promise<void> {
    const harFileParser: HarFileParser = new HarFileParser();
    await harFileParser.parse(filePath);
  }
}

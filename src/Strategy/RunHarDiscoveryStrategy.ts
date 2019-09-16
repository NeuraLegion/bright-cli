import {
  ArchiveRef,
  RunArchiveDiscoveryStrategy
} from './RunArchiveDiscoveryStrategy';
import { HarFileParser } from '../Parsers/HarFileParser';
import { createReadStream } from 'fs';

export class RunHarDiscoveryStrategy extends RunArchiveDiscoveryStrategy {
  constructor(baseUrl: string, apiKey: string) {
    super(baseUrl, apiKey);
  }

  protected async uploadArchive(
    filePath: string,
    discard: boolean = true
  ): Promise<ArchiveRef> {
    return this.proxy.post({
      uri: `/files`,
      qs: { discard },
      json: true,
      formData: {
        file: createReadStream(filePath)
      }
    });
  }

  protected async validateFile(filePath: string): Promise<void> {
    const harFileParser: HarFileParser = new HarFileParser();
    await harFileParser.parse(filePath);
  }
}

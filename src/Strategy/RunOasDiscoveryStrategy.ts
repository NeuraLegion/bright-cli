import {
  ArchiveRef,
  RunArchiveDiscoveryStrategy
} from './RunArchiveDiscoveryStrategy';
import { HarFileParser } from '../Parsers/HarFileParser';
import { createReadStream } from 'fs';
import { OasFileParser } from '../Parsers/OasFileParser';

export class RunOasDiscoveryStrategy extends RunArchiveDiscoveryStrategy {
  constructor(baseUrl: string, apiKey: string) {
    super(baseUrl, apiKey);
  }

  protected async uploadArchive(
    filePath: string,
    discard: boolean = true,
    headers?: { [key: string]: string }
  ): Promise<ArchiveRef> {
    return this.proxy.post({
      uri: `/specs`,
      qs: { discard },
      json: true,
      formData: {
        headers: headers && JSON.stringify(headers),
        file: createReadStream(filePath)
      }
    });
  }

  protected async validateFile(filePath: string): Promise<void> {
    const oasFileParser: OasFileParser = new OasFileParser();
    await oasFileParser.parse(filePath);
  }
}

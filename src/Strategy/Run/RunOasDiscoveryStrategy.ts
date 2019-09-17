import { RunArchiveDiscoveryStrategy } from './RunArchiveDiscoveryStrategy';
import { createReadStream } from 'fs';
import { OasFileParser } from '../../Parsers/OasFileParser';
import { Options as RequestOptions } from 'request';
import { Discovery, DiscoveryTypes } from './RunStrategyExecutor';

export class RunOasDiscoveryStrategy extends RunArchiveDiscoveryStrategy {
  get discovery(): DiscoveryTypes {
    return [Discovery.oas];
  }

  protected getUploadArchiveOptions(
    filePath: string,
    discard: boolean = true,
    headers?: { [key: string]: string }
  ): RequestOptions {
    return {
      uri: `/api/v1/specs`,
      qs: { discard },
      json: true,
      formData: {
        headers: headers && JSON.stringify(headers),
        file: createReadStream(filePath)
      }
    };
  }

  protected async validateFile(filePath: string): Promise<void> {
    const oasFileParser: OasFileParser = new OasFileParser();
    await oasFileParser.parse(filePath);
  }
}

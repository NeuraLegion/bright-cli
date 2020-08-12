import { UploadHARStrategy, UploadOASStrategy, UploadStrategy } from './Upload';
import { HarFileParser, OasParser } from '../Parsers';
import {
  FileExistingValidator,
  HarFileValidator,
  OasValidator
} from '../Validators';
import { Discovery } from './ScanManager';

export class UploadStrategyFactory {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly proxyUrl?: string
  ) {}

  public create(discovery: Discovery): UploadStrategy<any> {
    const fileValidator = new FileExistingValidator();
    switch (discovery) {
      case Discovery.ARCHIVE:
        return new UploadHARStrategy({
          baseUrl: this.baseUrl,
          apiKey: this.apiKey,
          proxyUrl: this.proxyUrl,
          fileParser: new HarFileParser(new HarFileValidator(), fileValidator)
        });
      case Discovery.OAS:
        return new UploadOASStrategy({
          baseUrl: this.baseUrl,
          apiKey: this.apiKey,
          proxyUrl: this.proxyUrl,
          fileParser: new OasParser(new OasValidator(), fileValidator)
        });
    }
  }
}

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
    private readonly apiKey: string
  ) {}

  public create(discovery: Discovery): UploadStrategy<any> {
    switch (discovery) {
      case Discovery.ARCHIVE:
        return new UploadHARStrategy(
          this.baseUrl,
          this.apiKey,
          new HarFileParser(new HarFileValidator(), new FileExistingValidator())
        );
      case Discovery.OAS:
        return new UploadOASStrategy(
          this.baseUrl,
          this.apiKey,
          new OasParser(new OasValidator(), new FileExistingValidator())
        );
    }
  }
}

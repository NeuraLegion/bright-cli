import { UploadStrategy } from './Upload/UploadStrategy';
import { UploadHARStrategy } from './Upload/UploadHARStrategy';
import { UploadOASStrategy } from './Upload/UploadOASStrategy';
import { HarFileParser } from '../Parsers/HarFileParser';
import { HarFileValidator } from '../Validators/HarFileValidator';
import { FileExistingValidator } from '../Validators/FileExistingValidator';
import { OasParser } from '../Parsers/OasParser';
import { OasValidator } from '../Validators/OasValidator';
import { Discovery } from './ScanManager';

export class UploadStrategyFactory {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  public Create(discovery: Discovery): UploadStrategy<any> {
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

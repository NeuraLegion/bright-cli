import {
  BaseNexMockConverter,
  BaseParser,
  DefaultHarRecorder,
  NexMockParser,
  OasParser,
  Parser,
  ParserFactory
} from './Parsers';
import { SpecType } from './Archives';
import {
  HarValidator,
  NexMockValidator,
  OasValidator,
  PostmanValidator
} from './Validators';

export class DefaultParserFactory implements ParserFactory {
  constructor(
    private readonly options: {
      proxyUrl?: string;
      timeout?: number;
      pool?: number;
      baseUrl?: string;
      headers?: Record<string, string>;
    }
  ) {}

  public create(spec: SpecType): Parser {
    switch (spec) {
      case SpecType.NEXMOCK:
        return new NexMockParser(
          new NexMockValidator(),
          new DefaultHarRecorder({
            timeout: 10000,
            maxRedirects: 20,
            pool: this.options.pool,
            proxyUrl: this.options.proxyUrl
          }),
          new BaseNexMockConverter({
            url: this.options.baseUrl,
            headers: this.options.headers
          })
        );
      case SpecType.HAR:
        return new BaseParser(new HarValidator());
      case SpecType.OPENAPI:
        return new OasParser(new OasValidator());
      case SpecType.POSTMAN:
        return new BaseParser(new PostmanValidator());
      default:
        return null;
    }
  }
}

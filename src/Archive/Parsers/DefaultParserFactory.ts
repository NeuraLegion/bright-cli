import { SpecType } from '../Archives';
import {
  HarValidator,
  NexMockValidator,
  OasValidator,
  PostmanValidator
} from '../Validators';
import { ParserFactory } from './ParserFactory';
import { HarRecorder, NexMockConverter } from './NexMock';
import { NexMockParser } from './NexMockParser';
import { BaseParser } from './BaseParser';
import { OasParser } from './OasParser';
import { Parser } from './Parser';
import { inject, injectable } from 'tsyringe';

@injectable()
export class DefaultParserFactory implements ParserFactory {
  constructor(
    private readonly nexMockValidator: NexMockValidator,
    private readonly harValidator: HarValidator,
    private readonly oasValidator: OasValidator,
    private readonly postmanValidator: PostmanValidator,
    @inject(NexMockConverter)
    private readonly nexMockConverter: NexMockConverter,
    @inject(HarRecorder) private readonly harRecorder: HarRecorder
  ) {}

  public create(spec: SpecType): Parser | never {
    switch (spec) {
      case SpecType.NEXMOCK:
        return new NexMockParser(
          this.nexMockValidator,
          this.harRecorder,
          this.nexMockConverter
        );
      case SpecType.HAR:
        return new BaseParser(this.harValidator);
      case SpecType.OPENAPI:
        return new OasParser(this.oasValidator);
      case SpecType.POSTMAN:
        return new BaseParser(this.postmanValidator);
      default:
        throw new Error('Incorrect a specification type');
    }
  }
}

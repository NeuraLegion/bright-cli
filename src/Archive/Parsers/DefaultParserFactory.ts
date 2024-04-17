import { SpecType } from '../Archives';
import { HarValidator, OasValidator, PostmanValidator } from '../Validators';
import { ParserFactory } from './ParserFactory';
import { BaseParser } from './BaseParser';
import { OasParser } from './OasParser';
import { Parser } from './Parser';
import { injectable } from 'tsyringe';

@injectable()
export class DefaultParserFactory implements ParserFactory {
  constructor(
    private readonly harValidator: HarValidator,
    private readonly oasValidator: OasValidator,
    private readonly postmanValidator: PostmanValidator
  ) {}

  public create(spec: SpecType): Parser | never {
    switch (spec) {
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

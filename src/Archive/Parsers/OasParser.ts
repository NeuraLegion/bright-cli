import { Validator } from '../Validators';
import { BaseParser } from './BaseParser';

export class OasParser extends BaseParser<any> {
  constructor(validator: Validator<any>) {
    super(validator);
  }

  protected async deserialize(
    file: string,
    meta: { ext: string }
  ): Promise<any> {
    if (meta.ext === '.yml' || meta.ext === '.yaml') {
      return (await import('js-yaml')).safeLoad(file);
    } else {
      return JSON.parse(file);
    }
  }
}

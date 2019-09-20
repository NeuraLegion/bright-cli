import { Entry, Har } from 'har-format';
import { Validator } from './Validator';
import * as ajv from 'ajv';
import { ValidateFunction } from 'ajv';
import { parse, Url } from 'url';
import harSchema from '../Utils/har-schema';

export class HarFileValidator implements Validator<Har> {
  private readonly ajv: ajv.Ajv;

  constructor() {
    this.ajv = new ajv({
      allErrors: true,
      async: true,
      jsonPointers: true,
      extendRefs: true
    });
    this.ajv.addSchema(harSchema);
  }

  public async validate(data: Har): Promise<void | never> {
    const validate: ValidateFunction = this.ajv.getSchema('har');

    if (!(await validate(data))) {
      throw new Error(
        `The HAR file is corrupted. ${this.ajv.errorsText(validate.errors)}`
      );
    }

    if (!this.entriesAreValid(data.log.entries)) {
      throw new Error(`HAR is empty or contains none of request.`);
    }
  }

  private entriesAreValid(entries: Entry[]): boolean {
    if (!entries) {
      return false;
    }

    const urls: string[] = entries
      .map(this.parseEntry, this)
      .filter((item: string) => !!item);

    const targets: string[] = [...new Set(urls).values()];

    return targets.length !== 0;
  }

  private parseEntry(entry: Entry): string | undefined {
    const { host, protocol }: Url = parse(entry.request.url);

    if (!host || !protocol) {
      return;
    }

    if (protocol === 'chrome-extension:') {
      return;
    }

    return entry.request.url;
  }
}

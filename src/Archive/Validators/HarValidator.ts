import { Validator } from './Validator';
import logger from '../../Utils/Logger';
import { Entry, Har } from 'har-format';
import Ajv from 'ajv';
import { ValidateFunction } from 'ajv';
import betterAjvErrors from 'better-ajv-errors';
import { parse, Url } from 'url';

export class HarValidator implements Validator<Har> {
  private readonly ajv: Ajv.Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      async: true,
      jsonPointers: true,
      extendRefs: true
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.ajv.addSchema(require('../../../schemas/har/schema.json'));
  }

  public async validate(data: Har): Promise<void | never> {
    const validate: ValidateFunction = this.ajv.getSchema('har');

    if (!(await validate(data))) {
      logger.error(
        betterAjvErrors(validate.schema, data, validate.errors, {
          indent: 2
        }) as any
      );
      throw new Error(`The HAR file is corrupted.`);
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

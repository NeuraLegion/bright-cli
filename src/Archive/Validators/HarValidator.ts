import { Validator } from './Validator';
import { logger } from '../../Utils';
import { Entry, Har } from 'har-format';
import Ajv from 'ajv';
import { ValidateFunction } from 'ajv';
import betterAjvErrors from 'better-ajv-errors';
import schema from 'schemas/har/schema.json';
import { injectable } from 'tsyringe';
import { parse, Url } from 'url';

@injectable()
export class HarValidator implements Validator<Har> {
  private readonly ajv: Ajv.Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      async: true,
      jsonPointers: true,
      extendRefs: true
    });
    this.ajv.addSchema(schema);
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

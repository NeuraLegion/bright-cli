import { Validator } from './Validator';
import { MockRequest } from '../Parsers';
import { logger } from '../../Utils';
import schema from './schemas/nexmock/schema.json';
import Ajv, { ValidateFunction } from 'ajv';
import betterAjvErrors from 'better-ajv-errors';
import { injectable } from 'tsyringe';

@injectable()
export class NexMockValidator implements Validator<MockRequest[]> {
  private readonly ajv: Ajv.Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      async: true
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.ajv.addSchema(schema);
  }

  public async validate(data: MockRequest[]): Promise<void | never> {
    const validate: ValidateFunction = this.ajv.getSchema('nexmock');

    if (!(await validate(data))) {
      logger.error(
        betterAjvErrors(validate.schema, data, validate.errors, {
          indent: 2
        }) as any
      );
      throw new Error(`The NexMock file is corrupted.`);
    }
  }
}

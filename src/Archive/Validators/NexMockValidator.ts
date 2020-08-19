import { Validator } from './Validator';
import { MockRequest } from '../Parsers';
import logger from '../../Utils/Logger';
import Ajv from 'ajv';
import { ValidateFunction } from 'ajv';
import betterAjvErrors from 'better-ajv-errors';

export class NexMockValidator implements Validator<MockRequest[]> {
  private readonly ajv: Ajv.Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      async: true
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.ajv.addSchema(require('../../../schemas/nexmock/schema.json'));
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

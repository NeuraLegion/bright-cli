import mockRequestsSchema from '../Utils/mock-requests-schema';
import * as ajv from 'ajv';
import { ValidateFunction } from 'ajv';
import { MockRequest } from '../Parsers/NexMockToRequestsParser';
import { Validator } from './Validator';

export class NexMockValidator implements Validator<MockRequest[]> {
  private readonly ajv: ajv.Ajv;

  constructor() {
    this.ajv = new ajv({
      allErrors: true,
      async: true
    });
    this.ajv.addSchema(mockRequestsSchema);
  }

  public async validate(data: MockRequest[]): Promise<void | never> {
    const validate: ValidateFunction = this.ajv.getSchema('requests');

    if (!(await validate(data))) {
      throw new Error(
        `The NexMock file is corrupted. ${this.ajv.errorsText(validate.errors)}`
      );
    }
  }
}

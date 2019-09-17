import * as ajv from 'ajv';
import { ValidateFunction } from 'ajv';
import { openapiV1, openapiV2, openapiV3 } from 'openapi-schemas';

export class OasValidator {
  private readonly ajv: ajv.Ajv;

  constructor() {
    this.ajv = new ajv({
      allErrors: true,
      async: true
    });
    this.ajv.addSchema(openapiV2, '2.0');
    this.ajv.addSchema(openapiV3, '3.0');
  }

  public async validate(data: any): Promise<void | never> {
    const validate: ValidateFunction = this.ajv.getSchema(
      data.swaggerVersion || data.swagger || data.openapi
    );

    if (!(await validate(data))) {
      throw new Error(
        `The OAS file is corrupted. ${this.ajv.errorsText(validate.errors)}`
      );
    }
  }
}

import * as ajv from 'ajv';
import { ValidateFunction } from 'ajv';
import { openapiV1, openapiV2, openapiV3 } from 'openapi-schemas';
import { Validator } from './Validator';

export class OasValidator implements Validator<any> {
  private readonly ajv: ajv.Ajv;

  constructor() {
    this.ajv = new ajv({
      allErrors: true,
      $data: true,
      jsonPointers: true,
      extendRefs: true,
      async: true,
      schemaId: 'auto'
    });
    const ajvFormats = require('ajv/lib/compile/formats.js');
    this.ajv.addFormat('uriref', ajvFormats.full['uri-reference']);
    this.ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
    (this.ajv as any)._refs['http://json-schema.org/schema'] =
      'http://json-schema.org/draft-04/schema'; // optional, using unversioned URI is out of spec
    this.ajv.addSchema(openapiV1, '1');
    this.ajv.addSchema(openapiV2, '2');
    this.ajv.addSchema(openapiV3, '3');
  }

  public async validate(data: any): Promise<void | never> {
    const validate: ValidateFunction = this.ajv.getSchema(
      (data.swaggerVersion || data.swagger || data.openapi)[0]
    );

    if (!(await validate(data))) {
      throw new Error(
        `The OAS file is corrupted. ${this.ajv.errorsText(validate.errors)}`
      );
    }
  }
}

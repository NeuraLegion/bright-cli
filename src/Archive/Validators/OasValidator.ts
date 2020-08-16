import { Validator } from './Validator';
import Ajv from 'ajv';
import { ValidateFunction } from 'ajv';
import semver from 'semver';
import betterAjvErrors from 'better-ajv-errors';
import { ok } from 'assert';
import { join } from 'path';

export class OasValidator implements Validator<any> {
  private readonly ajv: Ajv.Ajv;
  private readonly MIN_ALLOWED_VERSION = '2.0.0';
  private readonly VERSION_SCHEMA_MAP = new Map([
    [2, 'http://swagger.io/v2/schema.json#'],
    [3, 'https://spec.openapis.org/oas/3.0/schema/2019-04-02']
  ]);
  private readonly PATH_TO_SCHEMAS: ReadonlyArray<string> = [
    'schemas/openapi/v2.0/schema.json',
    'schemas/openapi/v3.0/schema.json'
  ];
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      $data: true,
      jsonPointers: true,
      extendRefs: true,
      async: true,
      schemaId: 'auto'
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ajvFormats = require('ajv/lib/compile/formats.js');
    this.ajv.addFormat('uriref', ajvFormats.full['uri-reference']);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
    (this.ajv as any)._refs['http://json-schema.org/schema'] =
      'http://json-schema.org/draft-04/schema'; // optional, using unversioned URI is out of spec
    this.PATH_TO_SCHEMAS.forEach((x: string) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const schema = require(join('../../../', x));
      this.ajv.addSchema(schema);
    });
  }

  public async validate(spec: any): Promise<void | never> {
    const version = this.getVersion(spec);

    const schemaNotFound =
      'Cannot determine version of schema. Schema ID is missed.';
    const major = semver.major(version);
    const schemaId = this.VERSION_SCHEMA_MAP.get(major);

    ok(schemaId, schemaNotFound);

    this.validateVersion(spec);

    const validate: ValidateFunction = this.ajv.getSchema(schemaId);

    if (!(await validate(spec))) {
      console.error(
        betterAjvErrors(validate.schema, spec, validate.errors, {
          indent: 2
        })
      );
      throw new Error(`The OAS file is corrupted.`);
    }
  }

  private validateVersion(spec: any): void | never {
    const version = this.getVersion(spec);

    if (!semver.gte(version, this.MIN_ALLOWED_VERSION)) {
      throw new Error(
        'Swagger v1 are not supported. If you are using an older format, convert it to v2 and try again.'
      );
    }
  }

  private getVersion(spec: any): string {
    let version = (spec.openapi || spec.swagger || '').trim();

    ok(version, 'Cannot determine version of specification.');

    if (
      !semver.valid(version) &&
      this.MIN_ALLOWED_VERSION.startsWith(version)
    ) {
      version = this.MIN_ALLOWED_VERSION;
    }

    return version;
  }
}

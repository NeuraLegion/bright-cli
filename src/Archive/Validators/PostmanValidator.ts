import { Validator } from './Validator';
import { logger } from '../../Utils';
import collectionV2Draft7 from 'schemas/postman/draft-07/v2.0.0/collection.json';
import collectionV2Draft4 from 'schemas/postman/draft-04/v2.0.0/collection.json';
import collectionDraft7 from 'schemas/postman/draft-07/v2.1.0/collection.json';
import collectionDraft4 from 'schemas/postman/draft-04/v2.1.0/collection.json';
import Ajv, { ValidateFunction } from 'ajv';
import betterAjvErrors from 'better-ajv-errors';
import schemaDraft04 from 'ajv/lib/refs/json-schema-draft-04.json';
import schemaDraft07 from 'ajv/lib/refs/json-schema-draft-07.json';
import { ok } from 'assert';
import { parse } from 'path';

export class PostmanValidator implements Validator<any> {
  private readonly ajv: Ajv.Ajv;
  private readonly ALLOWED_SCHEMAS: ReadonlyArray<string> = [
    'https://schema.getpostman.com/json/draft-07/collection/v2.0.0/',
    'https://schema.getpostman.com/json/draft-07/collection/v2.1.0/',
    'https://schema.getpostman.com/json/collection/v2.0.0/',
    'https://schema.getpostman.com/json/collection/v2.1.0/'
  ];
  private readonly META_SCHEMAS: ReadonlyArray<unknown> = [
    schemaDraft04,
    schemaDraft07
  ];
  private readonly SCHEMAS: ReadonlyArray<unknown> = [
    collectionV2Draft7,
    collectionV2Draft4,
    collectionDraft7,
    collectionDraft4
  ];

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      async: true,
      meta: false,
      schemaId: 'auto'
    });
    []
      .concat(this.META_SCHEMAS, this.SCHEMAS)
      .forEach((x: unknown) => this.ajv.addMetaSchema(x as any));
    (this.ajv as any)._refs['http://json-schema.org/schema'] =
      'http://json-schema.org/draft-04/schema'; // optional, using unversioned URI is out of spec
  }

  public async validate(collection: any): Promise<void | never> {
    ok(collection, 'Postman collection is not provided.');
    ok(collection.info, '"info" section is missed in the collection.');

    const schemaId: string = collection.info.schema
      ? parse(collection.info.schema).dir + '/'
      : '';

    if (!this.ALLOWED_SCHEMAS.includes(schemaId.trim())) {
      throw new Error(
        'Postman v1 collections are not supported. If you are using an older format, convert it to v2 and try again.'
      );
    }
    const validate: ValidateFunction | undefined = this.ajv.getSchema(schemaId);

    if (!validate) {
      throw new Error(
        'Cannot determine version of schema. Schema ID is missed.'
      );
    }

    if (!(await validate(collection))) {
      logger.error(
        betterAjvErrors(validate.schema, collection, validate.errors, {
          indent: 2
        }) as any
      );

      throw new Error(`The Postman Collection file is corrupted.`);
    }
  }
}

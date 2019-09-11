import {Options} from 'request';
import {Readable, Transform, TransformCallback} from 'stream';
import {URL} from 'url';

export interface Headers {
  readonly [key: string]: string | string[];
}

type PlanFormData = string | Buffer | Readable;

type FormDataField = PlanFormData | {
  value: PlanFormData,
  options: {
    filename: string;
    contentType: string
  }
};

export interface FormData {
  [key: string]: FormDataField | FormDataField[];
}

export enum MockRequestType {
  buffer = 'buffer',
  json = 'json',
  multipart = 'multipart',
  file = 'file',
  stream = 'stream',
  form_urlencoded = 'form_urlencoded',
  text = 'text'
}

export type SimpleBodyType = Exclude<MockRequestType, MockRequestType.multipart & MockRequestType.form_urlencoded>;

export interface GenericMockRequest<T extends MockRequestType> {
  readonly type: T;

  readonly method?: string;

  readonly headers?: Headers;

  readonly url?: string;
}

export interface SimpleTextMockRequest<T extends SimpleBodyType> extends GenericMockRequest<T> {
  readonly body: string;
}

export interface FileMockRequest extends SimpleTextMockRequest<MockRequestType.file> {
  readonly mimeType: string;

  readonly fileName: string;
}

export interface FormUrlencodedMockRequest extends GenericMockRequest<MockRequestType.form_urlencoded> {
  readonly body: {
    readonly [key: string]: SimpleTextMockRequest<MockRequestType.text>;
  };
}

export type MultiPartField = SimpleTextMockRequest<MockRequestType.text> |
  FileMockRequest;

export interface MultiPartMockRequest extends GenericMockRequest<MockRequestType.multipart> {
  readonly body: {
    readonly [key: string]: MultiPartField | MultiPartField[];
  };
}

export type MockRequest = FormUrlencodedMockRequest |
  MultiPartMockRequest |
  FileMockRequest |
  SimpleTextMockRequest<Exclude<SimpleBodyType, MockRequestType.file>>;

export class MockRequestsParser extends Transform {
  private readonly options: { headers?: Headers, url?: string };
  private readonly chunks: string[];

  constructor(options: { headers?: Headers, url?: string }) {
    super({objectMode: true});
    this.options = options;
    this.chunks = [];
  }

  public _transform(data: string, encoding: string, done: TransformCallback): void {
    this.chunks.push(data);
    done();
  }

  public _flush(callback: (error?: Error, data?: any) => void): void {
    try {
      const mocks: MockRequest[] = JSON.parse(this.chunks.join('')) as MockRequest[];

      if (!Array.isArray(mocks)) {
        return callback();
      }

      callback(null, mocks.map((item: MockRequest) =>
        this.mockToRequestOptions(item)
      ));
    } catch (e) {
      callback(new Error(`NexMock file is invalid. Check your file and try again.`));
    }
  }

  public mockToRequestOptions(mock: MockRequest): Options {
    if (!mock.method || !mock.url || !mock.type) {
      return null;
    }

    const defaultOptions: Options = {
      url: this.buildUrl(mock.url),
      headers: this.mergeHeaders(this.options.headers, mock.headers),
      method: mock.method
    };

    switch (mock.type) {
    case MockRequestType.file:
    case MockRequestType.stream:
    case MockRequestType.buffer:
      return {
        ...defaultOptions,
        body: Buffer.from(mock.body, 'base64')
      };
    case MockRequestType.json:
      return {
        ...defaultOptions,
        json: true,
        body: JSON.parse(mock.body)
      };
    case MockRequestType.multipart:
      return {
        ...defaultOptions,
        formData: this.mockFormDataPayload(mock as MultiPartMockRequest)
      };
    case MockRequestType.form_urlencoded:
      return {
        ...defaultOptions,
        form: mock.body
      };
    case MockRequestType.text:
    default:
      return {
        ...defaultOptions,
        body: mock.body
      };
    }
  }

  private mockFormDataPayload(request: MultiPartMockRequest): FormData {
    return Object.entries(request.body)
      .reduce((acc: FormData, [key, value]: [string, MultiPartField | MultiPartField[]]) => {
        acc[key] = Array.isArray(value) ?
          value.map(this.parseFormDataValue.bind(this)) :
          this.parseFormDataValue(value);
        return acc;
      }, {});
  }

  private parseFormDataValue(value: SimpleTextMockRequest<MockRequestType.text> | FileMockRequest) {
    return value.type !== MockRequestType.text ?
      {
        value: Buffer.from(value.body, 'base64'),
        options: {
          filename: value.fileName,
          contentType: value.mimeType
        }
      } :
      value.body;
  }

  private mergeHeaders(source: Headers, mockHeaders: Headers): Headers {
    return {...mockHeaders, ...source};
  }

  private buildUrl(urlOrPath: string = '/'): string {
    const pat: RegExp = /^https?:\/\//i;
    return pat.test(urlOrPath) ?
      urlOrPath :
      new URL(urlOrPath, this.options.url).toString();
  }
}

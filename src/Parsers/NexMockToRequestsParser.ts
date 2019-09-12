import { Options } from 'request';
import { Readable } from 'stream';
import { URL } from 'url';

export interface Headers {
  readonly [key: string]: string | string[];
}

type PlanFormData = string | Buffer | Readable;

type FormDataField =
  | PlanFormData
  | {
  value: PlanFormData;
  options: {
    filename: string;
    contentType: string;
  };
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

export type SimpleBodyType = Exclude<MockRequestType,
  MockRequestType.multipart & MockRequestType.form_urlencoded>;

export interface GenericMockRequest<T extends MockRequestType> {
  readonly type: T;

  readonly method?: string;

  readonly headers?: Headers;

  readonly url?: string;
}

export interface SimpleTextMockRequest<T extends SimpleBodyType>
  extends GenericMockRequest<T> {
  readonly body: string;
}

export interface FileMockRequest
  extends SimpleTextMockRequest<MockRequestType.file> {
  readonly mimeType: string;

  readonly fileName: string;
}

export interface FormUrlencodedMockRequest
  extends GenericMockRequest<MockRequestType.form_urlencoded> {
  readonly body: {
    readonly [key: string]: string;
  };
}

export type MultiPartField =
  | SimpleTextMockRequest<MockRequestType.text>
  | FileMockRequest;

export interface MultiPartMockRequest
  extends GenericMockRequest<MockRequestType.multipart> {
  readonly body: {
    readonly [key: string]: MultiPartField | MultiPartField[];
  };
}

export type MockRequest =
  | FormUrlencodedMockRequest
  | MultiPartMockRequest
  | FileMockRequest
  | SimpleTextMockRequest<Exclude<SimpleBodyType, MockRequestType.file>>;

export class NexMockToRequestsParser {
  private readonly options: { headers?: Headers; url?: string };

  constructor(options: { headers?: Headers; url?: string }) {
    this.options = options;
  }

  public async parse(mocks: MockRequest[]): Promise<Options[]> {
    return mocks.map((item: MockRequest) => this.mockToRequestOptions(item));
  }

  public mockToRequestOptions(mock: MockRequest): Options {
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
    return Object.entries(request.body).reduce(
      (
        acc: FormData,
        [key, value]: [string, MultiPartField | MultiPartField[]]
      ) => {
        acc[key] = Array.isArray(value)
          ? value.map(this.parseFormDataValue.bind(this))
          : this.parseFormDataValue(value);
        return acc;
      },
      {}
    );
  }

  private parseFormDataValue(
    value: SimpleTextMockRequest<MockRequestType.text> | FileMockRequest
  ) {
    return value.type !== MockRequestType.text
      ? {
        value: Buffer.from(value.body, 'base64'),
        options: {
          filename: value.fileName,
          contentType: value.mimeType
        }
      }
      : value.body;
  }

  private mergeHeaders(source: Headers, mockHeaders: Headers): Headers {
    return { ...mockHeaders, ...source };
  }

  private buildUrl(urlOrPath: string = '/'): string {
    const path: RegExp = /^https?:\/\//i;
    return path.test(urlOrPath)
      ? urlOrPath
      : new URL(urlOrPath, this.options.url).toString();
  }
}

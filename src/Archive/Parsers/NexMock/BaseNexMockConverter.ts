import { NexMockConverter } from './NexMockConverter';
import { Options } from 'request';
import { Readable } from 'stream';
import { URL } from 'url';

export interface Headers {
  [key: string]: string | string[];
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
  BUFFER = 'buffer',
  JSON = 'json',
  MULTIPART = 'multipart',
  FILE = 'file',
  STREAM = 'stream',
  FORM_URLENCODED = 'form_urlencoded',
  TEXT = 'text'
}

export type SimpleBodyType = Exclude<
  MockRequestType,
  MockRequestType.MULTIPART & MockRequestType.FORM_URLENCODED
>;

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
  extends SimpleTextMockRequest<MockRequestType.FILE> {
  readonly mimeType: string;

  readonly fileName: string;
}

export interface FormUrlencodedMockRequest
  extends GenericMockRequest<MockRequestType.FORM_URLENCODED> {
  readonly body: {
    readonly [key: string]: string;
  };
}

export type MultiPartField =
  | SimpleTextMockRequest<MockRequestType.TEXT>
  | FileMockRequest;

export interface MultiPartMockRequest
  extends GenericMockRequest<MockRequestType.MULTIPART> {
  readonly body: {
    readonly [key: string]: MultiPartField | MultiPartField[];
  };
}

export type MockRequest =
  | FormUrlencodedMockRequest
  | MultiPartMockRequest
  | FileMockRequest
  | SimpleTextMockRequest<Exclude<SimpleBodyType, MockRequestType.FILE>>;

export class BaseNexMockConverter implements NexMockConverter {
  constructor(
    private readonly options: { headers?: Record<string, string>; url?: string }
  ) {}

  public async convertToRequests(mocks: MockRequest[]): Promise<Options[]> {
    return mocks.map((item: MockRequest) => this.mockToRequestOptions(item));
  }

  public mockToRequestOptions(mock: MockRequest): Options {
    const defaultOptions: Options = {
      url: this.buildUrl(mock.url),
      headers: this.mergeHeaders(this.options.headers, mock.headers),
      method: mock.method
    };

    switch (mock.type) {
      case MockRequestType.FILE:
      case MockRequestType.STREAM:
      case MockRequestType.BUFFER:
        return {
          ...defaultOptions,
          body: Buffer.from(mock.body, 'base64')
        };
      case MockRequestType.JSON:
        return {
          ...defaultOptions,
          json: true,
          body: JSON.parse(mock.body)
        };
      case MockRequestType.MULTIPART:
        return {
          ...defaultOptions,
          formData: this.mockFormDataPayload(mock as MultiPartMockRequest)
        };
      case MockRequestType.FORM_URLENCODED:
        return {
          ...defaultOptions,
          form: mock.body
        };
      case MockRequestType.TEXT:
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
    value: SimpleTextMockRequest<MockRequestType.TEXT> | FileMockRequest
  ) {
    return value.type !== MockRequestType.TEXT
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
    const headers: Headers = { ...mockHeaders, ...source };

    return Object.entries(headers).reduce(
      (common: Headers, [key, value]: [string, string | string[]]) => {
        common[key] = Array.isArray(value) ? value.join('; ') : value;

        return common;
      },
      {}
    );
  }

  private buildUrl(urlOrPath: string = '/'): string {
    const path = /^https?:\/\//i;

    return path.test(urlOrPath)
      ? urlOrPath
      : new URL(urlOrPath, this.options.url).toString();
  }
}

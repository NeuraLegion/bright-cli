import {
  FileMockRequest,
  FormData,
  Headers,
  MockRequest,
  MockRequestType,
  MultiPartField,
  MultiPartMockRequest,
  NexMockConverter,
  SimpleTextMockRequest
} from './NexMockConverter';
import { Options } from 'request';
import { inject, injectable } from 'tsyringe';
import { URL } from 'url';

export interface NexMockConverterOptions {
  headers?: Record<string, string>;
  url?: string;
}

export const NexMockConverterOptions: unique symbol = Symbol(
  'NexMockConverterOptions'
);

@injectable()
export class BaseNexMockConverter implements NexMockConverter {
  constructor(
    @inject(NexMockConverterOptions)
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

import { Options } from 'request';
import { Readable } from 'stream';

export type Headers = Record<string, string | string[]>;

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

export type FormData = Record<string, FormDataField | FormDataField[]>;

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
  readonly body: Readonly<Record<string, string>>;
}

export type MultiPartField =
  | SimpleTextMockRequest<MockRequestType.TEXT>
  | FileMockRequest;

export interface MultiPartMockRequest
  extends GenericMockRequest<MockRequestType.MULTIPART> {
  readonly body: Readonly<Record<string, MultiPartField | MultiPartField[]>>;
}

export type MockRequest =
  | FormUrlencodedMockRequest
  | MultiPartMockRequest
  | FileMockRequest
  | SimpleTextMockRequest<Exclude<SimpleBodyType, MockRequestType.FILE>>;

export interface NexMockConverter {
  convertToRequests(mocks: MockRequest[]): Promise<Options[]>;
}

export const NexMockConverter: unique symbol = Symbol('NexMockConverter');

import { MockRequest } from './BaseNexMockConverter';
import { Options } from 'request';

export interface NexMockConverter {
  convertToRequests(mocks: MockRequest[]): Promise<Options[]>;
}

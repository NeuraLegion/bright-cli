import { Options } from 'request';

export interface HarRecorder {
  record(data: Options[]): Promise<string>;
}

export const HarRecorder: unique symbol = Symbol('HarRecorder');

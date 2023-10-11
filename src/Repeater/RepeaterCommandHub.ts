import { Request, Response } from '../RequestExecutor';
import { NetworkTestType } from './NetworkTestType';

export interface RepeaterCommandHub {
  compileScripts(script: string | Record<string, string>): void;
  testNetwork(type: NetworkTestType, input: string | string[]): Promise<string>;
  sendRequest(request: Request): Promise<Response>;
}

export const RepeaterCommandHub: unique symbol = Symbol('RepeaterCommandHub');

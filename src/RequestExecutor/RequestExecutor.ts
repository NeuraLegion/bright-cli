import { Request } from './Request';
import { Response } from './Response';
import { Protocol } from '../Handlers';

export interface RequestExecutor {
  execute(script: Request): Promise<Response>;
  protocol: Protocol;
}

export const RequestExecutor: unique symbol = Symbol('RequestExecutor');

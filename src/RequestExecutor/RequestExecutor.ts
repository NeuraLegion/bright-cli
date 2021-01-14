import { Request } from './Request';
import { Response } from './Response';

export interface RequestExecutor {
  execute(script: Request): Promise<Response>;
}

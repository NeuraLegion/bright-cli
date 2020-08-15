import { Script } from './Script';
import { ScriptResult } from './ScriptResult';

export interface RequestExecutor {
  execute(script: Script): Promise<ScriptResult>;
}

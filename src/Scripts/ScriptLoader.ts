export interface ScriptLoader {
  load(scripts: Record<string, string>): Promise<void>;
}

export const ScriptLoader: unique symbol = Symbol('ScriptLoader');

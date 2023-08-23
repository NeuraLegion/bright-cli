export interface RuntimeDetector {
  os(): string;

  arch(): string;

  isInsideDocker(): boolean;

  nodeVersion(): string;

  distribution(): string | undefined;
}

export const RuntimeDetector: unique symbol = Symbol('RuntimeDetector');

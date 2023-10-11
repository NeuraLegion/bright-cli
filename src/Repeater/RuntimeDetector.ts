export interface RuntimeDetector {
  ci(): string | undefined;

  os(): string;

  arch(): string;

  isInsideDocker(): boolean;

  nodeVersion(): string;

  distribution(): string | undefined;
}

export const RuntimeDetector: unique symbol = Symbol('RuntimeDetector');

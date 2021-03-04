export interface StartOptions {
  networkTestOnly: boolean
}

export interface Platform {
  start(options?: StartOptions): Promise<void>;
  stop(): Promise<void>;
}

export const Platform: unique symbol = Symbol('Platform');

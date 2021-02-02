export interface Platform {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export const Platform: unique symbol = Symbol('Platform');

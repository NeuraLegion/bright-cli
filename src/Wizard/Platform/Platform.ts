export interface Platform {
  start(): Promise<Platform>;
  stop(): Promise<void>;
}

export const Platform: unique symbol = Symbol('Platform');

export interface StartOptions {
  ping: boolean;
  traceroute?: string;
}

export interface Platform {
  start(options?: StartOptions): Promise<void>;

  stop(): Promise<void>;
}

export const Platform: unique symbol = Symbol('Platform');

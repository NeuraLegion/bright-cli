export interface TracerouteOptions {
  maxTTL?: number;
  probes?: number;
}

export interface StartOptions {
  ping: boolean;
  traceroute?: string;
  tracerouteOptions?: TracerouteOptions;
}

export interface Platform {
  start(options?: StartOptions): Promise<void>;

  stop(): Promise<void>;
}

export const Platform: unique symbol = Symbol('Platform');

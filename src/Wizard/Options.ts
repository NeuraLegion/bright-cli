export interface TracerouteOptions {
  maxTTL?: number;
  probes?: number;
}

export interface Options {
  traceroute?: TracerouteOptions;
}

export const Options: unique symbol = Symbol('Options');

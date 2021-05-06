export interface IntegrationOptions {
  readonly timeout: number;
  readonly apiKey?: string;
  readonly user?: string;
  readonly baseUrl?: string;
  readonly insecure?: boolean;
}

export const IntegrationOptions: unique symbol = Symbol('IntegrationOptions');

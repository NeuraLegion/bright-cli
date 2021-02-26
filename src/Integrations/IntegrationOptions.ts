export interface IntegrationOptions {
  readonly timeout: number;
  readonly apiKey?: string;
  readonly user?: string;
  readonly baseUrl?: string;
}

export const IntegrationOptions: unique symbol = Symbol('IntegrationOptions');

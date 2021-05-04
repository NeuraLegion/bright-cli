export const AUTH_TOKEN_VALIDATION_REGEXP = /^[A-Za-z0-9+/=]{7}\.nex[ap]\.[A-Za-z0-9+/=]{32}$/;

export interface Credentials {
  readonly authToken: string;
  readonly repeaterId: string;
}

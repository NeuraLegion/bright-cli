export const AUTH_TOKEN_VALIDATION_REGEXP = /^[A-Za-z0-9+/=]{7}\.nex[ap]\.[A-Za-z0-9+/=]{32}$/;
export const REPEATER_ID_VALIDATION_REGEXP = /^[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b$/i;

export interface Credentials {
  readonly authToken: string;
  readonly repeaterId: string;
}

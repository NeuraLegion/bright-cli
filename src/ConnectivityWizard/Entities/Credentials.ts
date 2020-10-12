export const AuthTokenValidationRegExp = /^[A-Za-z0-9+/=]{7}\.nex[ap]\.[A-Za-z0-9+/=]{32}$/g;
export const RepeaterIdValidationRegExp = /^[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b$/gi;

export interface Credentials {
  readonly authToken: string;
  readonly repeaterId: string;
}

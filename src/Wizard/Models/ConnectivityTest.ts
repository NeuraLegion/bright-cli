export enum TestType {
  HTTP = 'http',
  TCP = 'tcp',
  AUTH = 'auth'
}

export interface ConnectivityTest {
  readonly type: TestType;
}

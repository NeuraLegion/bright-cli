export type TestType = 'http' | 'tcp' | 'auth';

export interface ConnectivityTest {
    type: TestType
}
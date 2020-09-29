export { ScanId } from '../../../src/ConnectivityWizard/Entities/ScanId';
export { ItemStatus } from '../../../src/ConnectivityWizard/Entities/ConnectivityStatus';
export { Tokens } from '../../../src/ConnectivityWizard/Entities/Tokens';

export interface ConnectivityResponse {
  tcp: string;
  http: string;
  auth: string;
}

import { Status } from './components/scan/scan.component';

export interface ItemStatus {
  ok: boolean;
  msg?: string;
}

export interface Tokens {
  authToken: string;
  repeaterId: string;
}

export interface Scan {
  scanId: string;
}

export interface ConnectivityResponse {
  tcp: string;
  http: string;
  auth: string;
}

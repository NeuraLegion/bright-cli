import { ConnectivityTest } from './ConnectivityTest';

export interface ItemStatus {
  readonly ok: boolean;
  readonly msg?: string;
}

export type ConnectivityStatus = {
  readonly [key in ConnectivityTest]?: ItemStatus;
};

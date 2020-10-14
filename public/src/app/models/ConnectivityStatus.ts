import { ConnectivityTest } from './ConnectivityTest';

export interface ItemStatus {
  readonly ok: boolean;
  readonly type: ConnectivityTest;
  readonly msg?: string;
}

export type ConnectivityStatus = {
  readonly [key in ConnectivityTest]?: ItemStatus;
};

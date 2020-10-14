import { TestType } from './ConnectivityTest';

export interface ItemStatus {
  readonly ok: boolean;
  readonly msg?: string;
}

export type ConnectivityStatus = {
  readonly [key in TestType]?: ItemStatus;
};

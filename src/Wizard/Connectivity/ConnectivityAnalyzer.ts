import { TestType } from '../TestType';
import { URL } from 'url';

export interface ConnectivityAnalyzer {
  verifyAccess(type: TestType, url?: URL): Promise<boolean>;
}

export const ConnectivityAnalyzer: unique symbol = Symbol(
  'ConnectivityAnalyzer'
);

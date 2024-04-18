import { TestType } from '../TestType';

export interface ConnectivityAnalyzer {
  verifyAccess(type: TestType, target?: string | URL): Promise<boolean>;
}

export const ConnectivityAnalyzer: unique symbol = Symbol(
  'ConnectivityAnalyzer'
);

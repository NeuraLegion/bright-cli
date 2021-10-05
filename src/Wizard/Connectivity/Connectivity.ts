import { TestType } from '../TestType';
import { URL } from 'url';

export interface Connectivity {
  type: TestType;

  test(host: string | URL): Promise<boolean>;
}

export const Connectivity: unique symbol = Symbol('Connectivity');

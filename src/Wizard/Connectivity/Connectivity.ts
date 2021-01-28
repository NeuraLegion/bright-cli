import { TestType } from '../Models';
import { URL } from 'url';

export interface Connectivity {
  type: TestType;

  test(url: URL): Promise<boolean>;
}

export const Connectivity: unique symbol = Symbol('Connectivity');

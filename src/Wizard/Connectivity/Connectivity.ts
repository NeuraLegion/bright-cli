import { TestType, Options } from '../';
import { URL } from 'url';

export interface Connectivity {
  type: TestType;

  test(target: string | URL, opt?: Options): Promise<boolean>;
}

export const Connectivity: unique symbol = Symbol('Connectivity');

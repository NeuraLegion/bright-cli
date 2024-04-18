import { TestType } from '../TestType';
import { Options } from '../Options';

export interface Connectivity {
  type: TestType;

  test(target: string | URL, opt?: Options): Promise<boolean>;
}

export const Connectivity: unique symbol = Symbol('Connectivity');

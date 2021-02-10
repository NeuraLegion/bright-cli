import { should, use } from 'chai';
import promisified from 'chai-as-promised';

should();
use(promisified);

export * from './cli';

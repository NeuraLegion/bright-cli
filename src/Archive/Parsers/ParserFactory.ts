import { Parser } from './Parser';
import { SpecType } from '../Archives';

export interface ParserFactory {
  create(spec: SpecType): Parser;
}

export const ParserFactory: unique symbol = Symbol('ParserFactory');

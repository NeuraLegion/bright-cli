import { VirtualScript, VirtualScriptType } from './VirtualScript';

export interface VirtualScripts {
  size: number;

  [Symbol.iterator](): IterableIterator<[string, VirtualScript]>;

  clear(type?: VirtualScriptType): void;

  delete(key: string, recalculate?: boolean): boolean;

  entries(): IterableIterator<[string, VirtualScript]>;

  find(host: string): VirtualScript | undefined;

  keys(): IterableIterator<string>;

  set(wildcard: string, type: VirtualScriptType, code: string): this;

  values(): IterableIterator<VirtualScript>;

  count(type: VirtualScriptType): number;
}

export const VirtualScripts: unique symbol = Symbol('VirtualScripts');

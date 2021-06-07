import { VirtualScript, VirtualScriptType } from './VirtualScript';

export interface VirtualScripts {
  size: number;

  [Symbol.iterator](): IterableIterator<[string, VirtualScript]>;

  clear(type?: VirtualScriptType): void;

  delete(key: string): boolean;

  entries(): IterableIterator<[string, VirtualScript]>;

  find(host: string): VirtualScript | undefined;

  keys(): IterableIterator<string>;

  set(wildcard: string, type: VirtualScriptType, code: string): this;

  values(): IterableIterator<VirtualScript>;

  has(type: VirtualScriptType): boolean;
}

export const VirtualScripts: unique symbol = Symbol('VirtualScripts');

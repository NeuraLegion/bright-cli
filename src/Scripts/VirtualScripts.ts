import { VirtualScript } from './VirtualScript';

export interface VirtualScripts {
  [Symbol.iterator](): IterableIterator<[string, VirtualScript]>;

  clear(): void;

  delete(key: string): boolean;

  entries(): IterableIterator<[string, VirtualScript]>;

  find(host: string): VirtualScript | undefined;

  keys(): IterableIterator<string>;

  set(wildcard: string, code: string): this;

  values(): IterableIterator<VirtualScript>;
}

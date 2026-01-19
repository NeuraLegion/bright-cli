import { VirtualScript, VirtualScriptType } from './VirtualScript';
import { Helpers } from '../Utils';
import { VirtualScripts } from './VirtualScripts';
import { injectable } from 'tsyringe';

@injectable()
export class DefaultVirtualScripts implements VirtualScripts {
  private readonly _localScriptsSize: number;
  private readonly store = new Map<string, VirtualScript>();

  get size(): number {
    return this.store.size;
  }

  get localScriptsSize(): number {
    return this._localScriptsSize;
  }

  public [Symbol.iterator](): IterableIterator<[string, VirtualScript]> {
    return this.store[Symbol.iterator]();
  }

  public clear(type?: VirtualScriptType): void {
    if (!type) {
      this.store.clear();
    } else {
      this.store.forEach((x: VirtualScript) => {
        if (x.type === type) {
          this.delete(x.id, false);
        }
      });
    }

    if (!type || type === VirtualScriptType.LOCAL) {
      this.calculateLocalScriptsSize();
    }
  }

  public delete(key: string, recalculate: boolean = true): boolean {
    const result = this.store.delete(key);

    if (recalculate) {
      this.calculateLocalScriptsSize();
    }

    return result;
  }

  public entries(): IterableIterator<[string, VirtualScript]> {
    return this.store.entries();
  }

  public find(host: string): VirtualScript | undefined {
    return [...this.store.values()].find((script: VirtualScript) =>
      Helpers.wildcardToRegExp(script.id).test(host)
    );
  }

  public keys(): IterableIterator<string> {
    return this.store.keys();
  }

  public set(wildcard: string, type: VirtualScriptType, code: string): this {
    const script = new VirtualScript(wildcard, type, code);

    this.store.set(script.id, script);

    script.compile();

    this.calculateLocalScriptsSize();

    return this;
  }

  public values(): IterableIterator<VirtualScript> {
    return this.store.values();
  }

  private calculateLocalScriptsSize(): number {
    let count = 0;

    this.store.forEach((x: VirtualScript) => {
      if (x.type === VirtualScriptType.LOCAL) {
        count++;
      }
    });

    return count;
  }
}

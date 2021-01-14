import { VirtualScript } from './VirtualScript';
import { Helpers } from '../Utils/Helpers';
import { VirtualScripts } from './VirtualScripts';
import { injectable } from 'tsyringe';

@injectable()
export class DefaultVirtualScripts implements VirtualScripts {
  private readonly store = new Map<string, VirtualScript>();

  public [Symbol.iterator](): IterableIterator<[string, VirtualScript]> {
    return this.store[Symbol.iterator]();
  }

  public clear(): void {
    this.store.clear();
  }

  public delete(key: string): boolean {
    return this.store.delete(key);
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

  public set(wildcard: string, code: string): this {
    const script = new VirtualScript(wildcard, code);

    this.store.set(script.id, script);

    script.compile();

    return this;
  }

  public values(): IterableIterator<VirtualScript> {
    return this.store.values();
  }
}

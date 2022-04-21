import 'reflect-metadata';
import { DefaultVirtualScripts } from './DefaultVirtualScripts';
import { VirtualScript, VirtualScriptType } from './VirtualScript';
import { expect } from 'chai';

const isValidIterable = (
  instance: unknown
): instance is IterableIterator<unknown> => {
  if (instance === null || instance === undefined) {
    return false;
  }

  return typeof instance[Symbol.iterator] === 'function';
};

describe('DefaultVirtualScripts', () => {
  let virtualScripts: DefaultVirtualScripts;

  beforeEach(() => {
    virtualScripts = new DefaultVirtualScripts();
  });

  it('should be iterable', () => {
    expect(isValidIterable(virtualScripts)).to.equal(true);
  });

  describe('clear', () => {
    it('should remove all scripts when type is not passed', () => {
      virtualScripts.set('first', VirtualScriptType.LOCAL, 'let a = 1;');
      virtualScripts.set('second', VirtualScriptType.REMOTE, 'let a = 2;');

      virtualScripts.clear();

      expect(virtualScripts.size).to.equal(0);
    });

    it('should remove only VirtualScriptType.LOCAL scripts when VirtualScriptType.LOCAL type is passed', () => {
      virtualScripts.set('first', VirtualScriptType.LOCAL, 'let a = 1;');
      virtualScripts.set('second', VirtualScriptType.REMOTE, 'let a = 2;');

      virtualScripts.clear(VirtualScriptType.LOCAL);

      expect(virtualScripts.find('first')).to.undefined;
      expect(virtualScripts.find('second')).not.to.undefined;
    });

    it('should remove only VirtualScriptType.REMOTE scripts when VirtualScriptType.REMOTE type is passed', () => {
      virtualScripts.set('first', VirtualScriptType.LOCAL, 'let a = 1;');
      virtualScripts.set('second', VirtualScriptType.REMOTE, 'let a = 2;');

      virtualScripts.clear(VirtualScriptType.REMOTE);

      expect(virtualScripts.find('first')).not.to.undefined;
      expect(virtualScripts.find('second')).to.undefined;
    });
  });

  describe('delete', () => {
    it('should delete only one script by its key', () => {
      const keyToDelete = 'first';
      const keyToPreserve = 'second';
      virtualScripts.set(keyToDelete, VirtualScriptType.LOCAL, 'let a = 1;');
      virtualScripts.set(keyToPreserve, VirtualScriptType.REMOTE, 'let a = 2;');

      virtualScripts.delete(keyToDelete);

      expect(virtualScripts.find(keyToDelete)).to.be.undefined;
      expect(virtualScripts.find(keyToPreserve)).not.to.be.undefined;
    });

    it('should return true when successfully deleted key', () => {
      const keyToDelete = 'first';
      virtualScripts.set(keyToDelete, VirtualScriptType.LOCAL, 'let a = 1;');

      expect(virtualScripts.delete(keyToDelete)).to.equal(true);
    });

    it('should return false when not found key', () => {
      expect(virtualScripts.delete('anything')).to.equal(false);
    });
  });

  describe('entries', () => {
    it('should return all inserted entries in insertion order', () => {
      const key1 = '1';
      const key2 = '2';
      virtualScripts.set(key1, VirtualScriptType.REMOTE, 'let a = 1;');
      virtualScripts.set(key2, VirtualScriptType.REMOTE, 'let a = 2;');

      const entries = virtualScripts.entries();
      const [firstKey, firstScript]: [string, VirtualScript] =
        entries.next().value;
      const [secondKey, secondScript]: [string, VirtualScript] =
        entries.next().value;

      expect(firstKey).to.equal(key1);
      expect(firstScript.id).to.equal(key1);
      expect(secondKey).to.equal(key2);
      expect(secondScript.id).to.equal(key2);
    });
  });

  describe('find', () => {
    it('should find script when host matches exactly', () => {
      const host = 'example.com';
      virtualScripts.set(host, VirtualScriptType.REMOTE, 'let a = 2;');

      expect(virtualScripts.find(host)?.id).to.equal(host);
    });

    it('should find script when inserted host has matching wildcard', () => {
      const host = '*.example.com';
      virtualScripts.set(host, VirtualScriptType.REMOTE, 'let a = 2;');

      expect(virtualScripts.find('sub.example.com')?.id).to.equal(host);
    });

    it('should find first script per insertion order when inserted wildcards collide', () => {
      const host1 = '*.example.com';
      const host2 = '*.sub.example.com';
      virtualScripts.set(host1, VirtualScriptType.REMOTE, 'let a = 2;');
      virtualScripts.set(host2, VirtualScriptType.REMOTE, 'let a = 1;');

      expect(virtualScripts.find('test.sub.example.com')?.id).to.equal(host1);
    });
  });

  describe('keys', () => {
    it('should return all inserted keys in insertion order', () => {
      const key1 = '1';
      const key2 = '2';
      virtualScripts.set(key1, VirtualScriptType.REMOTE, 'let a = 1;');
      virtualScripts.set(key2, VirtualScriptType.REMOTE, 'let a = 2;');

      const keys = virtualScripts.keys();

      expect(keys.next().value).to.equal(key1);
      expect(keys.next().value).to.equal(key2);
    });
  });

  describe('set', () => {
    it('should be chainable', () => {
      expect(
        virtualScripts.set('first', VirtualScriptType.LOCAL, 'let a = 1;')
      ).to.equal(virtualScripts);
    });
    it('should create VirtualScript and store it', () => {
      const id = 'first';
      virtualScripts.set(id, VirtualScriptType.LOCAL, 'let a = 1;');

      expect(virtualScripts.find(id)).to.instanceOf(VirtualScript);
    });
    it('should overwrite previously set script when called with the same wildcard', () => {
      const wildcard = '*.example.com';
      virtualScripts.set(wildcard, VirtualScriptType.REMOTE, 'let a = 2;');
      const firstScript = virtualScripts.find(wildcard);
      virtualScripts.set(wildcard, VirtualScriptType.REMOTE, 'let a = 1;');
      const secondScript = virtualScripts.find(wildcard);

      expect(secondScript).not.to.undefined;
      expect(secondScript).not.to.equal(firstScript);
    });
  });

  describe('values', () => {
    it('should return all inserted values in insertion order', () => {
      const key1 = '1';
      const key2 = '2';
      virtualScripts.set(key1, VirtualScriptType.REMOTE, 'let a = 1;');
      virtualScripts.set(key2, VirtualScriptType.REMOTE, 'let a = 2;');

      const values = virtualScripts.values();

      expect(values.next().value.id).to.equal(key1);
      expect(values.next().value.id).to.equal(key2);
    });
  });
});

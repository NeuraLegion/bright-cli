import 'reflect-metadata';
import { DefaultVirtualScripts } from './DefaultVirtualScripts';
import { VirtualScript, VirtualScriptType } from './VirtualScript';
import { expect } from 'chai';

describe('DefaultVirtualScripts', () => {
  let virtualScripts!: DefaultVirtualScripts;

  beforeEach(() => {
    virtualScripts = new DefaultVirtualScripts();
  });

  describe('Symbol.iterator', () => {
    it('should be valid iterable', () => {
      // arrange
      const key1 = '1';
      const key2 = '2';
      virtualScripts.set(key1, VirtualScriptType.REMOTE, 'let a = 1;');
      virtualScripts.set(key2, VirtualScriptType.REMOTE, 'let a = 2;');
      // act
      // eslint-disable-next-line @typescript-eslint/typedef
      const [[firstKey, firstScript], [secondKey, secondScript]]: [
        string,
        VirtualScript
      ][] = [...virtualScripts];
      // assert
      expect(firstKey).to.equal(key1);
      expect(firstScript).to.include({ id: key1 });
      expect(secondKey).to.equal(key2);
      expect(secondScript).to.include({ id: key2 });
    });
  });

  describe('clear', () => {
    it('should remove all scripts when type is not passed', () => {
      // arrange
      virtualScripts.set('first', VirtualScriptType.LOCAL, 'let a = 1;');
      virtualScripts.set('second', VirtualScriptType.REMOTE, 'let a = 2;');
      // act
      virtualScripts.clear();
      // assert
      expect(Array.from(virtualScripts)).to.deep.equal([]);
    });

    it('should remove only VirtualScriptType.LOCAL scripts when VirtualScriptType.LOCAL type is passed', () => {
      // arrange
      virtualScripts.set('first', VirtualScriptType.LOCAL, 'let a = 1;');
      virtualScripts.set('second', VirtualScriptType.REMOTE, 'let a = 2;');
      // act
      virtualScripts.clear(VirtualScriptType.LOCAL);
      // assert
      expect(Array.from(virtualScripts)).to.deep.equal([
        [
          'second',
          new VirtualScript(
            'second',
            VirtualScriptType.REMOTE,
            'let a = 2;'
          ).compile()
        ]
      ]);
    });

    it('should remove only VirtualScriptType.REMOTE scripts when VirtualScriptType.REMOTE type is passed', () => {
      // arrange
      virtualScripts.set('first', VirtualScriptType.LOCAL, 'let a = 1;');
      virtualScripts.set('second', VirtualScriptType.REMOTE, 'let a = 2;');
      // act
      virtualScripts.clear(VirtualScriptType.REMOTE);
      // assert
      expect(Array.from(virtualScripts)).to.deep.equal([
        [
          'first',
          new VirtualScript(
            'first',
            VirtualScriptType.LOCAL,
            'let a = 1;'
          ).compile()
        ]
      ]);
    });
  });

  describe('delete', () => {
    it('should delete only one script by its key', () => {
      // arrange
      const keyToDelete = 'first';
      const keyToPreserve = 'second';
      virtualScripts.set(keyToDelete, VirtualScriptType.LOCAL, 'let a = 1;');
      virtualScripts.set(keyToPreserve, VirtualScriptType.REMOTE, 'let a = 2;');
      // act
      virtualScripts.delete(keyToDelete);
      // assert
      expect(Array.from(virtualScripts)).to.deep.equal([
        [
          keyToPreserve,
          new VirtualScript(
            keyToPreserve,
            VirtualScriptType.REMOTE,
            'let a = 2;'
          ).compile()
        ]
      ]);
    });

    it('should return true when successfully deleted key', () => {
      // arrange
      const keyToDelete = 'first';
      virtualScripts.set(keyToDelete, VirtualScriptType.LOCAL, 'let a = 1;');
      // act
      const deleteRes = virtualScripts.delete(keyToDelete);
      // assert
      expect(deleteRes).to.equal(true);
    });

    it('should return false when not found key', () => {
      // arrange
      // act
      const deleteRes = virtualScripts.delete('anything');
      // assert
      expect(deleteRes).to.equal(false);
    });
  });

  describe('entries', () => {
    it('should return all inserted entries in insertion order', () => {
      // arrange
      const key1 = '1';
      const key2 = '2';
      virtualScripts.set(key1, VirtualScriptType.REMOTE, 'let a = 1;');
      virtualScripts.set(key2, VirtualScriptType.REMOTE, 'let a = 2;');
      // act
      // eslint-disable-next-line @typescript-eslint/typedef
      const [[firstKey, firstScript], [secondKey, secondScript]] = Array.from(
        virtualScripts.entries()
      );
      // assert
      expect(firstKey).to.equal(key1);
      expect(firstScript).to.include({ id: key1 });
      expect(secondKey).to.equal(key2);
      expect(secondScript).to.include({ id: key2 });
    });
  });

  describe('find', () => {
    it('should find script when host matches exactly', () => {
      // arrange
      const host = 'example.com';
      virtualScripts.set(host, VirtualScriptType.REMOTE, 'let a = 2;');
      const expected = new VirtualScript(
        host,
        VirtualScriptType.REMOTE,
        'let a = 2;'
      ).compile();
      // act
      const foundScript = virtualScripts.find(host);
      // assert
      expect(foundScript).to.deep.equal(expected);
    });

    it('should find script when inserted host has matching wildcard', () => {
      // arrange
      const host = '*.example.com';
      virtualScripts.set(host, VirtualScriptType.REMOTE, 'let a = 2;');
      const expected = new VirtualScript(
        host,
        VirtualScriptType.REMOTE,
        'let a = 2;'
      ).compile();
      //act
      const foundScript = virtualScripts.find('sub.example.com');
      // assert
      expect(foundScript).to.deep.equal(expected);
    });

    it('should find first script per insertion order when inserted wildcards collide', () => {
      // arrange
      const host1 = '*.example.com';
      const host2 = '*.sub.example.com';
      virtualScripts.set(host1, VirtualScriptType.REMOTE, 'let a = 2;');
      virtualScripts.set(host2, VirtualScriptType.REMOTE, 'let a = 1;');
      const expected = new VirtualScript(
        host1,
        VirtualScriptType.REMOTE,
        'let a = 2;'
      ).compile();
      // act
      const foundScript = virtualScripts.find('test.sub.example.com');
      // assert
      expect(foundScript).to.deep.equal(expected);
    });
  });

  describe('keys', () => {
    it('should return all inserted keys in insertion order', () => {
      // arrange
      const key1 = '1';
      const key2 = '2';
      virtualScripts.set(key1, VirtualScriptType.REMOTE, 'let a = 1;');
      virtualScripts.set(key2, VirtualScriptType.REMOTE, 'let a = 2;');
      // act
      const keys = virtualScripts.keys();
      // assert
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
    it('should create and compile VirtualScript, and store it', () => {
      // arrange
      const id = 'first';
      // act
      virtualScripts.set(id, VirtualScriptType.LOCAL, 'let a = 1;');

      // assert
      expect(Array.from(virtualScripts)).to.deep.equal([
        [
          id,
          new VirtualScript(id, VirtualScriptType.LOCAL, 'let a = 1;').compile()
        ]
      ]);
    });
    it('should overwrite previously set script when called with the same wildcard', () => {
      // arrange
      const wildcard = '*.example.com';
      virtualScripts.set(wildcard, VirtualScriptType.LOCAL, 'let a = 2;');
      // act
      virtualScripts.set(wildcard, VirtualScriptType.REMOTE, 'let a = 1;');
      // assert
      expect(Array.from(virtualScripts)).to.deep.equal([
        [
          wildcard,
          new VirtualScript(
            wildcard,
            VirtualScriptType.REMOTE,
            'let a = 1;'
          ).compile()
        ]
      ]);
    });
  });

  describe('values', () => {
    it('should return all inserted values in insertion order', () => {
      // arrange
      const key1 = '1';
      const key2 = '2';
      virtualScripts.set(key1, VirtualScriptType.REMOTE, 'let a = 1;');
      virtualScripts.set(key2, VirtualScriptType.REMOTE, 'let a = 2;');
      // act
      const values = virtualScripts.values();
      // assert
      expect(values.next().value).to.include({ id: key1 });
      expect(values.next().value).to.include({ id: key2 });
    });
  });
});

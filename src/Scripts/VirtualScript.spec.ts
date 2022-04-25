import { VirtualScript, VirtualScriptType } from './VirtualScript';
import { expect, use } from 'chai';
import promisified from 'chai-as-promised';
import Module from 'module';

use(promisified);

describe('VirtualScript', () => {
  const identityScript = `
  const handle = (...args) => {
    return args;
  };
  exports.handle = handle;
  `;

  const createAndCompileVirtualScript = (code: string) => {
    const virtualScript = new VirtualScript(
      '123',
      VirtualScriptType.LOCAL,
      code
    );
    virtualScript.compile();

    return virtualScript;
  };

  it('should throw when constructed with falsy id', () => {
    expect(
      () => new VirtualScript('', VirtualScriptType.REMOTE, 'let a = 1;')
    ).to.throw();
    expect(
      () => new VirtualScript(null, VirtualScriptType.REMOTE, 'let a = 1;')
    ).to.throw();
    expect(
      () => new VirtualScript(undefined, VirtualScriptType.REMOTE, 'let a = 1;')
    ).to.throw();
  });

  it('should throw when constructed with falsy type', () => {
    expect(() => new VirtualScript('123', null, 'let a = 1;')).to.throw();
    expect(() => new VirtualScript('123', undefined, 'let a = 1;')).to.throw();
  });

  it('should throw when constructed with falsy code', () => {
    expect(
      () => new VirtualScript('123', VirtualScriptType.REMOTE, '')
    ).to.throw();
    expect(
      () => new VirtualScript('123', VirtualScriptType.REMOTE, null)
    ).to.throw();
    expect(
      () => new VirtualScript('123', VirtualScriptType.REMOTE, undefined)
    ).to.throw();
  });

  describe('compile', () => {
    it('should be chainable', () => {
      // arrange
      const virtualScript = new VirtualScript(
        '123',
        VirtualScriptType.REMOTE,
        'let a = 1;'
      );
      // act
      const compiledScript = virtualScript.compile();
      // assert
      expect(compiledScript).to.equal(virtualScript);
    });
  });

  describe('exec', () => {
    it('should pass arguments passed to it after first argument to the script', async () => {
      // arrange
      const virtualScript = createAndCompileVirtualScript(identityScript);
      const args = ['a', 'b', 'c'];

      // act
      const execPromise = virtualScript.exec('handle', ...args);
      // assert
      await expect(execPromise).to.eventually.have.members(args);
    });

    it('should execute the script with __dirname set to be current working directory', async () => {
      // arrange
      const returnDirnnameScript = `
      const handle = () => {
        return __dirname;
      };
      exports.handle = handle;
      `;

      const virtualScript = createAndCompileVirtualScript(returnDirnnameScript);
      // act
      const execPromise = virtualScript.exec('handle');
      // assert
      await expect(execPromise).to.eventually.equal(process.cwd());
    });

    it('should execute the script with a valid __filename', async () => {
      // arrange
      const returnFilenameScript = `
      const handle = () => {
        return __filename;
      };
      exports.handle = handle;
      `;

      const virtualScript = createAndCompileVirtualScript(returnFilenameScript);
      // act
      const execPromise = virtualScript.exec('handle');
      // assert
      await expect(execPromise).not.to.eventually.undefined;
    });

    it('should execute the script with a valid nodejs module', async () => {
      // arrange
      const returnModuleScript = `
      const handle = () => {
        return module;
      };
      exports.handle = handle;
      `;

      const virtualScript = createAndCompileVirtualScript(returnModuleScript);
      // act
      const execPromise = virtualScript.exec('handle');
      // assert
      await expect(execPromise).to.eventually.instanceOf(Module);
    });

    it('should throw when script does not have exported function with provided name', async () => {
      // arrange
      const virtualScript = createAndCompileVirtualScript('let a = 1;');
      // act
      const execPromise = virtualScript.exec('handle');
      // assert
      await expect(execPromise).to.be.rejected;
    });

    it('should throw when script has not been compiled before exec', async () => {
      // arrange
      const virtualScript = new VirtualScript(
        '123',
        VirtualScriptType.LOCAL,
        identityScript
      );
      // act
      const execPromise = virtualScript.exec('handle');
      // assert
      await expect(execPromise).to.be.rejected;
    });
  });
});

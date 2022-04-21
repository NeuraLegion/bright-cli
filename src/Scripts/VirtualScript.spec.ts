import { VirtualScript, VirtualScriptType } from './VirtualScript';
import { expect, use } from 'chai';
import promisified from 'chai-as-promised';
import Module from 'module';

use(promisified);

const identityScript = `
const handle = (...args) => {
  return args;
};
exports.handle = handle;
`;

const createAndCompileVirtualScript = (code: string) => {
  const virtualScript = new VirtualScript('123', VirtualScriptType.LOCAL, code);
  virtualScript.compile();

  return virtualScript;
};

describe('VirtualScript', () => {
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
      const virtualScript = new VirtualScript(
        '123',
        VirtualScriptType.REMOTE,
        'let a = 1;'
      );
      expect(virtualScript.compile()).to.equal(virtualScript);
    });
  });

  describe('exec', () => {
    it('should pass arguments passed to it after first argument to the script', async () => {
      const virtualScript = createAndCompileVirtualScript(identityScript);
      const args = ['a', 'b', 'c'];
      await expect(
        virtualScript.exec('handle', ...args)
      ).to.eventually.have.members(args);
    });

    it('should execute the script with __dirname set to be current working directory', async () => {
      const returnDirnnameScript = `
      const handle = () => {
        return __dirname;
      };
      exports.handle = handle;
      `;

      const virtualScript = createAndCompileVirtualScript(returnDirnnameScript);

      await expect(virtualScript.exec('handle')).to.eventually.equal(
        process.cwd()
      );
    });

    it('should execute the script with a valid __filename', async () => {
      const returnFilenameScript = `
      const handle = () => {
        return __filename;
      };
      exports.handle = handle;
      `;

      const virtualScript = createAndCompileVirtualScript(returnFilenameScript);

      await expect(virtualScript.exec('handle')).not.to.eventually.undefined;
    });

    it('should execute the script with a valid nodejs module', async () => {
      const returnModuleScript = `
      const handle = () => {
        return module;
      };
      exports.handle = handle;
      `;

      const virtualScript = createAndCompileVirtualScript(returnModuleScript);

      await expect(virtualScript.exec('handle')).to.eventually.instanceOf(
        Module
      );
    });

    it('should throw when script does not have exported function with provided name', async () => {
      const virtualScript = createAndCompileVirtualScript('let a = 1;');
      await expect(virtualScript.exec('handle')).to.be.rejected;
    });

    it('should throw when script has not been compiled before exec', async () => {
      const virtualScript = new VirtualScript(
        '123',
        VirtualScriptType.LOCAL,
        identityScript
      );
      await expect(virtualScript.exec('handle')).to.be.rejected;
    });
  });
});

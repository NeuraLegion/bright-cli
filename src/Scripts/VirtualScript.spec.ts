import { VirtualScript, VirtualScriptType } from './VirtualScript';
import Module from 'module';

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

  describe('constructor', () => {
    ['', undefined, null].forEach((input) =>
      it(`should throw an error if "${input}" is supplied as ID`, () => {
        expect(
          () => new VirtualScript(input, VirtualScriptType.REMOTE, 'let a = 1;')
        ).toThrowError();
      })
    );

    [undefined, null].forEach((input) =>
      it(`should throw an error if "${input}" is supplied as type`, () => {
        expect(
          () => new VirtualScript('123', input, 'let a = 1;')
        ).toThrowError();
      })
    );

    ['', undefined, null].forEach((input) =>
      it(`should throw an error if "${input}" is supplied as code`, () => {
        expect(
          () => new VirtualScript('123', VirtualScriptType.REMOTE, input)
        ).toThrowError();
      })
    );
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
      expect(compiledScript).toBe(virtualScript);
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
      await expect(execPromise).resolves.toEqual(args);
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
      await expect(execPromise).resolves.toBe(process.cwd());
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
      await expect(execPromise).resolves.toBeDefined();
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
      await expect(execPromise).resolves.toBeInstanceOf(Module);
    });

    it('should throw when script does not have exported function with provided name', async () => {
      // arrange
      const virtualScript = createAndCompileVirtualScript('let a = 1;');

      // act
      const execPromise = virtualScript.exec('handle');

      // assert
      await expect(execPromise).rejects.toThrowError();
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
      await expect(execPromise).rejects.toThrowError();
    });
  });
});

import 'reflect-metadata';
import { FSScriptLoader } from './FSScriptLoader';
import { VirtualScriptType } from './VirtualScript';
import { Logger, logger } from '../Utils';
import { VirtualScripts } from './VirtualScripts';
import {
  anyString,
  deepEqual,
  instance,
  mock,
  reset,
  spy,
  verify,
  when
} from 'ts-mockito';
import fs from 'node:fs/promises';

describe('FSScriptLoader', () => {
  const mockedVirtualScripts = mock<VirtualScripts>();
  const spiedFs = spy(fs);

  let spiedLogger!: Logger;
  let scriptLoader!: FSScriptLoader;

  beforeEach(() => {
    spiedLogger = spy(logger);
    scriptLoader = new FSScriptLoader(instance(mockedVirtualScripts));
  });

  afterEach(() => reset<unknown>(mockedVirtualScripts, spiedFs, spiedLogger));

  describe('load', () => {
    it('should load scripts from paths with type local each one only once', async () => {
      // arrange
      const code = 'let a = 1;';

      when(
        spiedFs.readFile(anyString(), deepEqual({ encoding: 'utf8' as const }))
      ).thenResolve(code);

      const path1 = 'test.js';
      const path2 = 'test1.js';

      // act
      await scriptLoader.load({
        [path1]: code,
        [path2]: code
      });
      // assert
      verify(
        mockedVirtualScripts.set(path1, VirtualScriptType.LOCAL, code)
      ).once();
      verify(
        mockedVirtualScripts.set(path2, VirtualScriptType.LOCAL, code)
      ).once();
    });

    it('should log with debug level and throw if cannot read file', async () => {
      // arrange
      when(
        spiedFs.readFile(anyString(), deepEqual({ encoding: 'utf8' as const }))
      ).thenReject(new Error('msg'));

      // act
      const loadPromise = scriptLoader.load({
        test: 'test'
      });

      // assert
      await expect(loadPromise).rejects.toThrowError();

      verify(spiedLogger.debug(anyString())).once();
    });
  });
});

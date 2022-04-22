import 'reflect-metadata';
import { DefaultVirtualScripts } from './DefaultVirtualScripts';
import { FSScriptLoader } from './FSScriptLoader';
import { VirtualScriptType } from './VirtualScript';
import { logger } from '../Utils';
import {
  anyFunction,
  anyString,
  anything,
  instance,
  mock,
  spy,
  verify,
  when
} from 'ts-mockito';
import { expect, use } from 'chai';
import promisified from 'chai-as-promised';
import fs from 'fs';

use(promisified);

const createScriptLoader = () => {
  const mockedVirtualScripts = mock(DefaultVirtualScripts);
  const virtualScripts = instance(mockedVirtualScripts);
  const scriptLoader = new FSScriptLoader(virtualScripts);

  return { virtualScripts, mockedVirtualScripts, scriptLoader };
};

describe('FSScriptLoader', () => {
  const spiedFs = spy(fs);
  describe('load', () => {
    it('should load scripts from paths with type local each one only once', async () => {
      // arrange
      const { mockedVirtualScripts, scriptLoader } = createScriptLoader();

      const code = 'let a = 1;';

      when(spiedFs.readFile(anyString(), anything(), anyFunction())).thenCall(
        (_path, _opts, callback) => callback(null, code)
      );

      // act
      const path1 = 'test.js';
      const path2 = 'test1.js';

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
      const { scriptLoader } = createScriptLoader();

      when(spiedFs.readFile(anyString(), anything(), anyFunction())).thenCall(
        (_path, _opts, callback) => callback(new Error('msg'), null)
      );

      const spiedLogger = spy(logger);
      // act
      const loadPromise = scriptLoader.load({
        test: 'test'
      });

      // assert
      await expect(loadPromise).to.be.rejected;

      verify(spiedLogger.debug(anyString())).once();
    });
  });
});

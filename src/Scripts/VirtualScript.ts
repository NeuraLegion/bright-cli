/* eslint-disable @typescript-eslint/naming-convention */
import { Context, createContext, Script } from 'vm';
import Module from 'module';
import { join } from 'path';

interface VirtualScriptContext extends Context {
  module: Module;
  __filename: string;
  __dirname: string;
}

export class VirtualScript {
  public readonly id: string;
  private readonly MODULE_EXEC_ARGS: ReadonlyArray<string> = [
    'module.exports',
    'module.require',
    'module',
    '__filename',
    '__dirname'
  ];
  private readonly script: Script;
  private context: VirtualScriptContext;

  constructor(id: string, code: string) {
    if (!id) {
      throw new Error('ID must be declared explicitly.');
    }
    this.id = id;

    if (!code) {
      throw new Error('Code must be declared explicitly.');
    }
    console.log(this.wrapScriptCode(code));
    this.script = new Script(this.wrapScriptCode(code), {
      filename: id
    });
  }

  public compile(): this {
    const module = new Module(this.id);
    this.context = createContext({
      module,
      __filename: join(this.id, process.cwd()),
      __dirname: process.cwd()
    }) as VirtualScriptContext;

    return this;
  }

  public async exec<Fun extends (...args: any[]) => any>(
    functionName: string,
    ...functionArgs: Parameters<Fun>
  ): Promise<ReturnType<Fun>> {
    this.script.runInContext(this.context, {
      timeout: 100
    });

    const { exports = {} } = this.context.module;

    const func: Fun = exports[functionName];

    if (typeof func !== 'function') {
      throw new Error(
        `Cannot find ${functionName} function in ${this.id} script.`
      );
    }

    return func(...functionArgs);
  }

  private wrapScriptCode(code: string): string {
    const decoratedModule = Module.wrap(code);

    return `${decoratedModule.slice(
      0,
      decoratedModule.length - 1
    )}(${this.MODULE_EXEC_ARGS.join(',')})`;
  }
}
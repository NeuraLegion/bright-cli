import { bind, Handler } from '../Bus';
import { VirtualScripts, VirtualScriptType } from '../Scripts';
import { RegisterScripts } from './Events';
import { inject, injectable } from 'tsyringe';

@injectable()
@bind(RegisterScripts)
export class RegisterScriptsHandler implements Handler<RegisterScripts> {
  constructor(
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts
  ) {}

  public async handle(event: RegisterScripts): Promise<void> {
    this.virtualScripts.clear(VirtualScriptType.REMOTE);

    const { script } = event;

    if (typeof script === 'string') {
      this.virtualScripts.set('*', VirtualScriptType.REMOTE, script);
    } else if (script) {
      Object.entries(script).map(([wildcard, code]: [string, string]) =>
        this.virtualScripts.set(wildcard, VirtualScriptType.REMOTE, code)
      );
    }
  }
}

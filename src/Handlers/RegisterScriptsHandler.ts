import { bind, Handler } from '../Bus';
import { VirtualScripts } from '../Scripts';
import { RegisterScripts } from './Events';
import { inject, injectable } from 'tsyringe';

@injectable()
@bind(RegisterScripts)
export class RegisterScriptsHandler implements Handler<RegisterScripts> {
  constructor(
    @inject(VirtualScripts) private readonly virtualScripts: VirtualScripts
  ) {}

  public async handle(event: RegisterScripts): Promise<void> {
    if (typeof event.script === 'string') {
      this.virtualScripts.set('*', event.script);
    } else {
      Object.entries(event).map(([wildcard, code]: [string, string]) =>
        this.virtualScripts.set(wildcard, code)
      );
    }
  }
}

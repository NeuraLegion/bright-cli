import { bind, Handler } from '../Bus';
import { RegisterScripts } from './Events';
import { RepeaterCommandHub } from '../Repeater';
import { inject, injectable } from 'tsyringe';

@injectable()
@bind(RegisterScripts)
export class RegisterScriptsHandler implements Handler<RegisterScripts> {
  constructor(
    @inject(RepeaterCommandHub) private readonly commandHub: RepeaterCommandHub
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  public async handle(event: RegisterScripts): Promise<void> {
    if (event.script) {
      this.commandHub.compileScripts(event.script);
    }
  }
}

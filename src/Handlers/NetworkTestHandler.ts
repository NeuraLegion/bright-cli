import { bind, Handler } from '../Bus';
import { NetworkTest } from './Events';
import { RepeaterCommandHub } from '../Repeater';
import { inject, injectable } from 'tsyringe';

type NetworkTestResult =
  | {
      output: string;
    }
  | {
      error: string;
    };

@injectable()
@bind(NetworkTest)
export class NetworkTestHandler
  implements Handler<NetworkTest, NetworkTestResult>
{
  constructor(
    @inject(RepeaterCommandHub) private readonly commandHub: RepeaterCommandHub
  ) {}

  public async handle(config: NetworkTest): Promise<NetworkTestResult> {
    try {
      const output = await this.commandHub.testNetwork(
        config.type,
        config.input
      );

      return { output };
    } catch (e) {
      return {
        error: typeof e === 'string' ? e : (e as Error).message
      };
    }
  }
}

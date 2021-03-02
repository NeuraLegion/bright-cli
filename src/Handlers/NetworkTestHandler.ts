import { bind, Handler } from '../Bus';
import { NetworkTest } from './Events';
import { NetworkTestResult } from '../Integrations';
import { injectable } from 'tsyringe';

@injectable()
@bind(NetworkTest)
export class NetworkTestHandler
  implements Handler<NetworkTest, NetworkTestResult> {

  public handle({repeaterId}: NetworkTest): Promise<NetworkTestResult> {
    console.log(123);

    return Promise.resolve({ output: 'test_output' , repeaterId});
  }
}

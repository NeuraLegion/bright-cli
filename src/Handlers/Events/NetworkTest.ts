import { Event } from '../../Bus';
import { NetworkTestType } from '../../Repeater';

export class NetworkTest implements Event {
  constructor(
    public readonly repeaterId: string,
    public readonly type: NetworkTestType,
    public readonly input: string | string[]
  ) {}
}

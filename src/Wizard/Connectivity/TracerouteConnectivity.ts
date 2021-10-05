import { Connectivity } from './Connectivity';
import { logger, Traceroute } from '../../Utils';
import { TestType } from '../TestType';
import { injectable } from 'tsyringe';
import { once } from 'events';

@injectable()
export class TracerouteConnectivity implements Connectivity {
  public readonly type = TestType.TRACEROUTE;

  public async test(host: string): Promise<boolean> {
    const trace = new Traceroute(host);

    try {
      trace.start();

      const res = await once(trace, 'done');

      logger.debug('Traceroute test has been finished.');

      return res[0].reached;
    } catch (err) {
      trace.close();

      logger.debug('Traceroute test has been failed: %s', err.message);

      return false;
    }
  }
}

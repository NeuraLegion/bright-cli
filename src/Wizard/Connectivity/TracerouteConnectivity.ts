import { Connectivity } from './Connectivity';
import { logger, Traceroute } from '../../Utils';
import { TestType, Options } from '../';
import { injectable } from 'tsyringe';

@injectable()
export class TracerouteConnectivity implements Connectivity {
  public readonly type = TestType.TRACEROUTE;

  public async test(target: string, opt?: Options): Promise<boolean> {
    const trace = new Traceroute(target, {
      maximumHops: opt?.traceroute?.maxTTL,
      amountProbes: opt?.traceroute?.probes
    });

    try {
      const reached = await trace.execute();

      logger.debug('Traceroute test has been finished.');

      return reached;
    } catch (err) {
      logger.debug('Traceroute test has been failed: %s', err.message);

      return false;
    }
  }
}

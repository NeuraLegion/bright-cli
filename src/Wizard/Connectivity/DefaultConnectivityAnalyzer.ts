import { Connectivity } from './Connectivity';
import { ConnectivityAnalyzer } from './ConnectivityAnalyzer';
import { logger } from '../../Utils';
import { TestType } from '../TestType';
import { Options } from '../Options';
import { inject, injectable, injectAll } from 'tsyringe';

export const ConnectivityUrls = Symbol('ConnectivityUrls');

@injectable()
export class DefaultConnectivityAnalyzer implements ConnectivityAnalyzer {
  constructor(
    @inject(ConnectivityUrls)
    private readonly urls: Map<TestType, string | URL>,
    @inject(Options) private readonly opt: Options,
    @injectAll(Connectivity)
    private readonly connectivityTestRegistry: Connectivity[]
  ) {}

  public async verifyAccess(
    type: TestType,
    target?: string | URL
  ): Promise<boolean> {
    logger.debug('Calling connectivity status test with type %s', type);

    const connectivity: Connectivity | undefined =
      this.connectivityTestRegistry.find((x: Connectivity) => x.type === type);

    if (!connectivity) {
      throw new Error('Selected test is not support.');
    }

    return connectivity.test(
      target ?? this.urls.get(connectivity.type),
      this.opt
    );
  }
}

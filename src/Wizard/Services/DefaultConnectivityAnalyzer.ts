import { Connectivity } from '../Connectivity';
import { TestType } from '../Models/ConnectivityTest';
import { ConnectivityAnalyzer } from './ConnectivityAnalyzer';
import { inject, injectable, injectAll } from 'tsyringe';
import { logger } from 'src/Utils';
import { URL } from 'url';

export const ConnectivityUrls = Symbol('ConnectivityUrls');

@injectable()
export class DefaultConnectivityAnalyzer implements ConnectivityAnalyzer {
  constructor(
    @inject(ConnectivityUrls) private readonly urls: Map<TestType, URL>,
    @injectAll(Connectivity)
    private readonly connectivityTestRegistry: Connectivity[]
  ) {}

  public async verifyAccess(type: TestType, url?: URL): Promise<boolean> {
    logger.debug('Calling connectivity status test with type %s', type);

    const connectivity:
      | Connectivity
      | undefined = this.connectivityTestRegistry.find(
      (x: Connectivity) => x.type === type
    );

    if (!connectivity) {
      throw new Error('Selected test is not support.');
    }

    return connectivity.test(url ?? this.urls.get(connectivity.type));
  }
}

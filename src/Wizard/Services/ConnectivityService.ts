import { Connectivity } from '../Connectivity/Connectivity';
import { TestType } from '../Models/ConnectivityTest';
import { inject, injectable, injectAll } from 'tsyringe';
import { logger } from 'src/Utils';
import { URL } from 'url';

export const ConnectivityUrls = Symbol('ConnectivityUrls');

@injectable()
export class ConnectivityAnalyzer {
  constructor(
    @inject(ConnectivityUrls) private readonly options: Map<TestType, URL>,
    @injectAll(Connectivity)
    private readonly connectivityTestRegistry: Connectivity[]
  ) {}

  public async verifyAccess(type: TestType): Promise<boolean> {
    logger.debug('Calling connectivity status test with type %s', type);

    const connectivity = this.findConnectivity(type);

    return connectivity.test(this.options.get(connectivity.type));
  }

  public async verifyConnection(url: URL): Promise<boolean> {
    const connectivity = this.findConnectivity(TestType.HTTP);

    return connectivity.test(url);
  }

  private findConnectivity(type: TestType): Connectivity {
    const connectivity:
      | Connectivity
      | undefined = this.connectivityTestRegistry.find(
      (x: Connectivity) => x.type === type
    );

    if (!connectivity) {
      throw new Error('Selected test is not support.');
    }

    return connectivity;
  }
}

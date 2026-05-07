/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import { VirtualScripts } from '../Scripts/VirtualScripts';
import { RequestExecutor } from './RequestExecutor';
import { Response } from './Response';
import { Request } from './Request';
import { logger, ProxyFactory } from '../Utils';
import { Protocol } from './Protocol';
import {
  CurlLibrary,
  HttpCurlRequestExecutor
} from './HttpCurlRequestExecutor';
import { CertificatesCache } from './CertificatesCache';
import { CertificatesResolver } from './CertificatesResolver';
import { RequestExecutorOptions } from './RequestExecutorOptions';
import { HttpLegacyRequestExecutor } from './HttpLegacyRequestExecutor';
import { inject, injectable } from 'tsyringe';

@injectable()
export class HttpRequestExecutor implements RequestExecutor {
  private readonly delegate: RequestExecutor;

  get protocol(): Protocol {
    return Protocol.HTTP;
  }

  constructor(
    @inject(VirtualScripts) readonly virtualScripts: VirtualScripts,
    @inject(ProxyFactory) readonly proxyFactory: ProxyFactory,
    @inject(RequestExecutorOptions)
    readonly options: RequestExecutorOptions,
    @inject(CertificatesCache)
    readonly certificatesCache: CertificatesCache,
    @inject(CertificatesResolver)
    readonly certificatesResolver: CertificatesResolver
  ) {
    try {
      this.delegate = new HttpCurlRequestExecutor(
        // eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
        require('node-libcurl') as CurlLibrary,
        virtualScripts,
        options,
        certificatesCache,
        certificatesResolver
      );
      logger.debug('node-libcurl is available, using libcurl HTTP executor');
    } catch {
      logger.warn(
        'node-libcurl is unavailable, falling back to legacy HTTP executor'
      );
      this.delegate = new HttpLegacyRequestExecutor(
        virtualScripts,
        proxyFactory,
        options,
        certificatesCache,
        certificatesResolver
      );
    }
  }

  public execute(options: Request): Promise<Response> {
    return this.delegate.execute(options);
  }
}

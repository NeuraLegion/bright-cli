// @ts-ignore
import { CaptureHar } from 'capture-har';
import request from 'request';
import { CoreOptions, Options } from 'request';
import { split } from '../Utils/split';
import { Parser } from './Parser';

export class RequestCrawler implements Parser<Options[] | string> {
  private readonly options: CoreOptions;
  private readonly proxy: CaptureHar;
  private readonly pool: number;

  constructor({
    pool = 250,
    timeout = 5000,
    maxRedirects = 20
  }: {
    timeout: number;
    pool?: number;
    maxRedirects?: number;
  }) {
    this.options = {
      timeout,
      maxRedirects,
      strictSSL: false
    };
    this.pool = pool;
    this.proxy = new CaptureHar(request.defaults(this.options));
  }

  public async parse(data: Options[]): Promise<string> {
    const requests: Options[] = Array.isArray(data) ? data : [data];
    const chunks: Options[][] = split<Options[], Options>(requests, this.pool);

    await chunks.reduce(
      (total: Promise<void>, partOfRequests: Options[]) =>
        total.then(
          () =>
            Promise.all<void>(
              partOfRequests.map((opt: Options) => this.executeRequest(opt))
            ) as any
        ),
      Promise.resolve()
    );

    return JSON.stringify(this.proxy.stop());
  }

  private executeRequest(opt: Options): Promise<void> {
    return new Promise<void>((resolve) =>
      this.proxy
        .start(opt)
        .once('end', resolve)
        .once('error', (err: Error) => resolve())
    );
  }
}

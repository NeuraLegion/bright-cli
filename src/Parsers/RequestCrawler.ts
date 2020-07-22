import { split } from '../Utils/split';
import { Parser } from './Parser';
import { CaptureHar } from '@neuralegion/capture-har';
import request, { CoreOptions, Options, OptionsWithUrl } from 'request';
import { Stream } from 'stream';

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
      ((this.proxy.start(opt as OptionsWithUrl) as unknown) as Stream)
        .once('end', resolve)
        .once('error', () => resolve())
    );
  }
}

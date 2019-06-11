// @ts-ignore
import {CaptureHar} from 'capture-har';
import * as request from 'request';
import {CoreOptions, Options} from 'request';
import {Transform, TransformCallback} from 'stream';

export class RequestCrawler extends Transform {
  private readonly options: CoreOptions;
  private readonly proxy: CaptureHar;

  constructor(options: { timeout: number, maxRedirects?: number, maxSockets?: number, strictSSL?: boolean }) {
    super({readableObjectMode: true, writableObjectMode: true});
    this.options = {timeout: 5000, ...options};
    this.proxy = new CaptureHar(request.defaults(options));
  }

  public _flush(done: TransformCallback): void {
    done(null, JSON.stringify(this.proxy.stop()));
  }

  public _transform(data: Options, encoding: string, done: TransformCallback): void {
    this.proxy
      .start({...data})
      .once('end', done)
      .once('error', (err: Error) => done());
  }
}

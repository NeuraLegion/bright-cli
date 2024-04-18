import { Transform, TransformCallback } from 'node:stream';

export class NormalizeZlibDeflateTransformStream extends Transform {
  private hasCheckedHead = false;
  private readonly header = Buffer.from([0x78, 0x9c]);
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ) {
    if (!this.hasCheckedHead && chunk.length !== 0) {
      // ADHOC: detects raw deflate: https://stackoverflow.com/a/37528114
      if (chunk.compare(this.header, 0, 1, 0, 1) !== 0) {
        this.push(this.header, encoding);
      }
      this.hasCheckedHead = true;
    }

    this.push(chunk, encoding);
    callback();
  }
}

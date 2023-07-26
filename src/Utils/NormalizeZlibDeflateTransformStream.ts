import { Transform, TransformCallback } from 'stream';

export class NormalizeZlibDeflateTransformStream extends Transform {
  private hasCheckedHead = false;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ) {
    if (!this.hasCheckedHead && chunk.length !== 0) {
      // ADHOC: detects raw deflate: https://stackoverflow.com/a/37528114
      if (chunk[0] !== 0x78) {
        const header = Buffer.from([0x78, 0x9c]);
        this.push(header, encoding);
      }
      this.hasCheckedHead = true;
    }

    this.push(chunk, encoding);
    callback();
  }
}

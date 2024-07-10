import { NormalizeZlibDeflateTransformStream } from './NormalizeZlibDeflateTransformStream';
import { promisify } from 'node:util';
import { constants, createInflate, deflate, deflateRaw } from 'node:zlib';
import { Readable } from 'node:stream';

const zOpts = {
  flush: constants.Z_SYNC_FLUSH,
  finishFlush: constants.Z_SYNC_FLUSH
};

// TODO: replace with Readable.from once support for Node 10 is dropped
const readableFrom = (buffer: Buffer) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  return stream;
};

describe('NormalizeZlibDeflateTransformStream', () => {
  it('should add zlib headers to raw deflate', async () => {
    // arrange
    const data = 'xyz'.repeat(200);

    const stream = readableFrom(await promisify(deflateRaw)(data, zOpts));
    // act
    const inflated = stream
      .pipe(new NormalizeZlibDeflateTransformStream())
      .pipe(createInflate(zOpts));
    // assert
    const result = [];
    for await (const chunk of inflated) {
      result.push(chunk);
    }
    expect(result.join('')).toBe(data);
  });

  it('should not affect deflate with zlib headers', async () => {
    // arrange
    const data = 'xyz'.repeat(200);

    const stream = readableFrom(await promisify(deflate)(data, zOpts));
    // act
    const inflated = stream
      .pipe(new NormalizeZlibDeflateTransformStream())
      .pipe(createInflate(zOpts));
    // assert
    const result = [];
    for await (const chunk of inflated) {
      result.push(chunk);
    }
    expect(result.join('')).toBe(data);
  });
});

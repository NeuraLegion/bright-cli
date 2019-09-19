export function split<T extends R[], R>(array: T, count: number): R[][] {
  if (!Array.isArray(array)) {
    throw new TypeError(`First argument must be an instance of Array.`);
  }

  const countItemInChunk: number = Math.ceil(array.length / count);

  return Array(countItemInChunk)
    .fill(null)
    .map(
      (_value: string, i: number) =>
        array.slice(i * count, i * count + count) as R[]
    );
}

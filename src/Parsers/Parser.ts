export interface Parser<B, T = any> {
  parse(data: B): Promise<T | null>;
}

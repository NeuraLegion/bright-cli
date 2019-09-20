export interface Validator<T> {
  validate(path: T): Promise<void | never>;
}

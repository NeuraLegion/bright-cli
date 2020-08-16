export interface Validator<T> {
  validate(value: T): Promise<void | never>;
}

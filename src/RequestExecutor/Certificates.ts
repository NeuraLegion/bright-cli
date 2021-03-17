export interface Certificates {
  load(): Promise<void>;
}

export const Certificates: unique symbol = Symbol('Certificates');

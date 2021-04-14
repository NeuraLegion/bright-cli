export interface Certificates {
  load(path?: string): Promise<void>;
}

export const Certificates: unique symbol = Symbol('Certificates');

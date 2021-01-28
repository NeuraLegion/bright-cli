import { Server } from 'net';

export interface Platform {
  start(): Promise<Server>;
}

export const Platform: unique symbol = Symbol('Platform');

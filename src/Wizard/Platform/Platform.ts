import { Server } from 'net';

export interface Platform {
  start(): Promise<Server>;
}

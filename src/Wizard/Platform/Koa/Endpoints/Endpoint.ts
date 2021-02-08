import Koa from 'koa';

export interface Endpoint {
  handle(ctx: Koa.Context): Promise<void>;
}

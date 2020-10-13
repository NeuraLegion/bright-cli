import Router from 'koa-router';

export interface KoaRouterFactory {
  createRouter(): Promise<Router>;
}

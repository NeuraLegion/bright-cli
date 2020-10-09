import Router from 'koa-router';

export interface RouterFactory {
  createRouter(): Promise<Router>;
}

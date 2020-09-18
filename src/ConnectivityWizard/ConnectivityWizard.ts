import Koa from 'koa';
import Router from 'koa-router';
import json from 'koa-json';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';

import { Tokens } from './Tokens';
import { ConnectivityStatus } from './ConnectivityStatus';
import { ScannedUrl } from './ScannedUrl';
import { ScanId } from './ScanId';

export class ConnectivityWizard {
    private app: Koa;
    constructor() {
        this.app = new Koa();
        
        // this.app.use(async (ctx: { body: string; }) => {
        //   ctx.body = 'Hello World';
        // });
  
    
        let router: Router = new Router();
        router.get('/api/tokens', async function (ctx: Koa.Context, next: Koa.Next) {
            let resp: Tokens = {
                authToken: 'some auth token',
                repeaterId: 'some repeater id'
            };
            ctx.body = resp;
            await next();
        });
        router.post('/api/tokens', async function (ctx: Koa.Context, next: Koa.Next) {
            let req = <Tokens>ctx.body;
            let resp: Tokens = req;
            ctx.body = resp;
            await next();
        });

        router.get('/api/connectivty-status', async function (ctx: Koa.Context, next: Koa.Next) {
            let res: ConnectivityStatus = {
                auth: {
                    ok: true,
                    msg: 'success'
                },
                https: {
                    ok: true,
                    msg: 'success'
                },
                tcp: {
                    ok: true,
                    msg: 'success'
                }
            };
            ctx.body = res;
            await next();
        });
        
        router.post('/api/scan', async function (ctx: Koa.Context, next: Koa.Next) {
            let req = <ScannedUrl>ctx.req;
            console.log(req.url);
            let resp: ScanId = {
                scanId: "500"
            };
            ctx.body = resp;
            await next();
        });
        console.log(__dirname + '/../Wizard/dist/Wizard');
        this.app.use(serve(__dirname + '/../Wizard/dist/Wizard'));
        this.app.use(json());
        this.app.use(bodyParser());
        this.app.use(router.routes());
        // this.app.use(async function (ctx: Koa.Context) {
        //     await send(ctx, 'Wizard/dist/Wizard/index.html');
        // });

        this.app.listen(3000);
    }

    
}
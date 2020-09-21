import Koa from 'koa';
import Router from 'koa-router';
import json from 'koa-json';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';

import { Tokens } from './Tokens';
import { ItemStatus } from './ConnectivityStatus';
import { ScannedUrl } from './ScannedUrl';
import { ScanId } from './ScanId';
import { Socket } from 'net';
import { ConnectivityTest } from './ConnectivityTest';
import * as https from 'https';
import * as httpReq from 'request';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';


import { URL } from 'url';
import { ClientRequest, IncomingMessage } from 'http';

export class ConnectivityWizard {
    private app: Koa;
    constructor() {
        this.app = new Koa();
        
        // this.app.use(async (ctx: { body: string; }) => {
        //   ctx.body = 'Hello World';
        // });
  
    
        let router: Router = new Router();
        router.get('/api/tokens', async (ctx: Koa.Context, next: Koa.Next) => {
            let resp: Tokens = this.readTokens();
            ctx.body = resp;
            await next();
        });
        router.post('/api/tokens', async (ctx: Koa.Context, next: Koa.Next) => {
            let req = <Tokens>ctx.request.body;
            this.writeTokens(req);
            let resp: Tokens = req;
            ctx.body = resp;
            await next();
        });

        router.post('/api/connectivty-status', async (ctx: Koa.Context, next: Koa.Next) => {
            let req = <ConnectivityTest><unknown>ctx.request.body;
            console.log(`Calling connectivity status test with type ${req}`)
            switch (req.type) {
                case "tcp":
                    let tcpRes: boolean = await this.testTCPConnection();
                    ctx.body = <ItemStatus>{
                        ok: tcpRes
                    };
                    break;
                case "auth":
                    let authRes: boolean = await this.testAuthConnection();
                    ctx.body = <ItemStatus>{
                        ok: authRes
                    };
                    break;                
                case "http":
                    let httpRes: boolean = await this.testHTTPConnection();
                    ctx.body = <ItemStatus>{
                        ok: httpRes
                    };
                    break;
                default:
                    ctx.body = <ItemStatus>{
                        ok: false
                    };
            }
            await next();
        });
        
        router.post('/api/scan', async (ctx: Koa.Context, next: Koa.Next) => {
            let req = <ScannedUrl>ctx.req;
            console.log(req.url);
            let resp: ScanId = {
                scanId: "500"
            };
            ctx.body = resp;
            await next();
        });

        router.post('/api/finish', async () => {
            process.exit(0);
        });

        console.log(process.argv);
        console.log(__dirname + '/../../Wizard/dist/Wizard');
        this.app.use(serve(__dirname + '/../../Wizard/dist/Wizard'));
        this.app.use(json());
        this.app.use(bodyParser());
        this.app.use(router.routes());
        // this.app.use(async function (ctx: Koa.Context) {
        //     await send(ctx, 'Wizard/dist/Wizard/index.html');
        // });

        this.app.listen(3000);
    }

    private async testAuthConnection(): Promise<boolean> {
        const url: URL = new URL(`https://nexploit.app/api/v1/agents/user`);
        const timeoutMs = 30 * 1000; // 30 seconds
        const tokens: Tokens = this.readTokens();
        return new Promise<boolean>((resolve) => {
            let req: httpReq.Request = httpReq.post({
                    url: url,
                    form: {
                        username: tokens.repeaterId, 
                        password: tokens.authToken, 
                    }
                }, (error: any, response: httpReq.Response, body: string) =>{
                    if (error || response.statusCode != 200) {
                        resolve(false);
                    }
                    resolve(body === 'allow');
                }
            );
            req.on('error', ()=> {
                console.log('auth req error handler called');
                resolve(false);
            });
            setTimeout(() => {
                console.log('calling auth call destroy');
                req.destroy();
                console.log('auth call destroy called');
            }, timeoutMs);
        });
    }

    private async testHTTPConnection(): Promise<boolean> {
        const url: URL = new URL(`https://nexploit.app:443`);
        const timeoutMs = 30 * 1000; // 30 seconds
        return new Promise<boolean>((resolve) => {
            let req: ClientRequest = https.get(url, (res: IncomingMessage) =>{
                console.log(`received message`);
                res.on('data', ()=>{
                    console.log('data handler called');
                    resolve(true);
                });
                res.on('end', ()=> {
                    console.log('end handler called');
                    resolve(true);
                });
                res.on('error', ()=> {
                    console.log('resp error handler called');
                    resolve(true);
                });
            });
            req.on('error', ()=> {
                console.log('req error handler called');
                resolve(false);
            });
            setTimeout(() => {
                console.log('calling https destroy');
                req.destroy();
                console.log('https destroy called');
            }, timeoutMs);
        });
    }

    private async testTCPConnection(): Promise<boolean> {
        const fqdn: string = 'amq.nexploit.app';
        const port: number = 5672;
        const timeoutMs = 30 * 1000; // 30 seconds

        return new Promise<boolean>((resolve) => {
            console.log('calling testTCP')
            let socket: Socket = new Socket();
            let timeout: NodeJS.Timeout = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, timeoutMs);
            socket.connect(port, fqdn, () => {
                console.log('testTCP":: connection established successfully')
                socket.destroy();
                clearTimeout(timeout);
                resolve(true);     
            });
            socket.on('error', (err: Error) => {
                console.log('testTCP":: connection failed')
                console.log(err);
                clearTimeout(timeout);
                socket.destroy();
                resolve(false);
            });
        });
    }

    private readTokens():Tokens {
        const p: string = path.join(os.homedir(), '.nexploit_auth');
        if (fs.existsSync(p)) {
            let result: Buffer = fs.readFileSync(p);
            return <Tokens><unknown>JSON.parse(result.toString('utf8'));
        }
        return {
            authToken: "",
            repeaterId: "",
        };
    }

    private writeTokens(tokens: Tokens):void {
        const p: string = path.join(os.homedir(), '.nexploit_auth');
        fs.writeFileSync(p,JSON.stringify(tokens));
    }

    
}
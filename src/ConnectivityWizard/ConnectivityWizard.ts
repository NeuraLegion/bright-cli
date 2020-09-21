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
import * as child_processes from 'child_process';
import logger from '../Utils/Logger';
import { URL } from 'url';
import { ClientRequest, IncomingMessage } from 'http';

export class ConnectivityWizard {
    private authTestEndpoint: string = 'https://nexploit.app/api/v1/repeaters/user';
    private httpTestEndpoint: string = 'https://nexploit.app:443';
    private tcpTestFQDN: string = 'amq.nexploit.app';
    private tcptTestPort: number = 5672;

    private app: Koa;
    constructor() {
        this.app = new Koa();
  
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
            logger.debug(`Calling connectivity status test with type ${req}`)
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
            logger.debug('Finish wizard, terminating the process');
            
            process.exit(0);
        });

        const staticPath: string = __dirname + '/../Wizard/dist/Wizard';
        logger.debug(staticPath);
        this.app.use(serve(staticPath));
        this.app.use(json());
        this.app.use(bodyParser());
        this.app.use(router.routes());
        // this.app.use(async function (ctx: Koa.Context) {
        //     await send(ctx, 'Wizard/dist/Wizard/index.html');
        // });

        this.app.listen(3000);
    }

    private async testAuthConnection(): Promise<boolean> {
        const url: URL = new URL(this.authTestEndpoint);
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
                logger.error('Auth HTTP connection failed. Could not make HTTP call to auth endpoint.');
                resolve(false);
            });
            setTimeout(() => {
                logger.debug('testAuthConnection reached timeout. Destroying the HTTP connecttion.');
                req.destroy();
            }, timeoutMs);
        });
    }

    private async testHTTPConnection(): Promise<boolean> {
        const url: URL = new URL(this.httpTestEndpoint);
        const timeoutMs = 30 * 1000; // 30 seconds
        return new Promise<boolean>((resolve) => {
            let req: ClientRequest = https.get(url, (res: IncomingMessage) =>{
                res.on('data', ()=>{
                    logger.debug('Http connectivity test - received data the connection.The connection is succesfull.');
                    resolve(true);
                });
                res.on('end', ()=> {
                    logger.debug('Http connectivity test - connection closed by server. The connection is succesfull.');
                    resolve(true);
                });
                res.on('error', ()=> {
                    logger.debug('Http connectivity test - received HTTP error code on connection. The connection is succesfull.');
                    resolve(true);
                });
            });
            req.on('error', ()=> {
                logger.debug('Http connectivity test - received an error code on connection. The connection failed.');
                resolve(false);
            });
            setTimeout(() => {
                logger.debug('Http connectivity test - reached timeout. The connection failed.');
                req.destroy();
            }, timeoutMs);
        });
    }

    private async testTCPConnection(): Promise<boolean> {
        const timeoutMs = 30 * 1000; // 30 seconds

        return new Promise<boolean>((resolve) => {
            logger.debug(`TCP connectivity test - openning socket to ${this.tcpTestFQDN}:${this.tcptTestPort}`);
            let socket: Socket = new Socket();
            let timeout: NodeJS.Timeout = setTimeout(() => {
                logger.debug(`TCP connectivity test - reached socket timeout. Connection failed.`);
                socket.destroy();
                resolve(false);
            }, timeoutMs);
            socket.connect(this.tcptTestPort, this.tcpTestFQDN, () => {
                logger.debug(`TCP connectivity test - Connection succesfull.`);
                socket.destroy();
                clearTimeout(timeout);
                resolve(true);     
            });
            socket.on('error', (err: Error) => {
                logger.debug(`TCP connectivity test - received socket error. Connection failed.`, err);
                clearTimeout(timeout);
                socket.destroy();
                resolve(false);
            });
        });
    }

    private readTokens():Tokens {
        const p: string = path.join(os.homedir(), '.nexploit_auth');
        logger.debug(`Reading saved tokens from file ${p}`);
        if (fs.existsSync(p)) {
            logger.debug("File found. Returns the value");
            let result: Buffer = fs.readFileSync(p);
            return <Tokens><unknown>JSON.parse(result.toString('utf8'));
        } else {
            logger.debug("File doesn't exist. Returning empty values");
            return {
                authToken: "",
                repeaterId: "",
            };
        }
    }

    private writeTokens(tokens: Tokens):void {
        const p: string = path.join(os.homedir(), '.nexploit_auth');
        logger.debug(`Saving tokens to file ${p}`);
        fs.writeFileSync(p,JSON.stringify(tokens));
    }

    // private async executeRepeater(): Promise<boolean> {
    //     let startArgs: string[] = process.argv.filter(x=>x != 'configure');
    //     let p:child_processes.ChildProcess = child_processes.spawn(startArgs);
    // }

    // private async startScan(): Promise<string> {
    //     return null;
    // }
}
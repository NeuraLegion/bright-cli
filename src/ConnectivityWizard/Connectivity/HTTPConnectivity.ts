import { Connectivity } from './Connectivity';
import https from 'https';
import http from 'http';
import { ClientRequest } from 'http';
import { URL } from 'url';
import logger from '../../Utils/Logger';

export class HTTPConnectivity implements Connectivity {
    private readonly http_test_endpoint: string = 'https://nexploit.app:443';
    private readonly connection_timeout = 30 * 1000; // 30 seconds

    public async test(): Promise<boolean> {
        const url: URL = new URL(this.http_test_endpoint);

        return new Promise<boolean>((resolve) => {
        const req: ClientRequest =
            url.protocol === 'https:' ? https.get(url) : http.get(url);

        req.once('response', () => {
            logger.debug(
            'Http connectivity test - received data the connection.The connection is succesfull.'
            );
            resolve(true);
        });
        req.once('error', () => {
            logger.debug(
            'Http connectivity test - received an error code on connection. The connection failed.'
            );
            resolve(false);
        });
        setTimeout(() => {
            logger.debug(
            'Http connectivity test - reached timeout. The connection failed.'
            );
            req.destroy();
        }, this.connection_timeout);
        });
    }
};
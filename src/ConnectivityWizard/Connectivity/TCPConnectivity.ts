import { Connectivity } from './Connectivity';
import logger from '../../Utils/Logger';
import { Socket } from 'net';
import { URL } from 'url';

export class TCPConnectivity implements Connectivity {
  private readonly connection_timeout = 30 * 1000; // 30 seconds
  
  private fqdn: string;
  private port: number;
  
  constructor(url: URL) {
      if (!url || !url.hostname || !url.port) {
        throw new Error('Missing proper endpoint and port for tcp connectivity test');
      }
      this.fqdn = url.hostname;
      this.port = +url.port;
  }

  public async test(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      logger.debug(
        `TCP connectivity test - openning socket to ${this.fqdn}:${this.port}`
      );
      const socket: Socket = new Socket();
      socket.setNoDelay(false);
      socket.setTimeout(this.connection_timeout, () => {
        logger.debug(
          `TCP connectivity test - reached socket timeout. Connection failed.`
        );
        socket.destroy();
        resolve(false);
      });
      socket.connect(this.port, this.fqdn, () => {
        logger.debug(`TCP connectivity test - Connection succesfull.`);
        socket.destroy();
        resolve(true);
      });
      socket.on('error', (err: Error) => {
        logger.debug(
          `TCP connectivity test - received socket error. Connection failed.`,
          err
        );
        socket.destroy();
        resolve(false);
      });
    });
  }
}
